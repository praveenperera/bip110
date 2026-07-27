@genType
type rawBlock = {
  status: string,
  height: string,
  hash: string,
  version: string,
  time: string,
  nTx: string,
}

@genType
type monitorBlocks = {
  blocks: array<Monitor.unclassifiedMonitorBlock>,
  updatedAt: string,
}

let maxInt = 2_147_483_647

@val external parseIntRadix: (string, int) => float = "parseInt"

let parseDecimalInt = value =>
  switch Float.fromString(value) {
  | Some(parsed)
    if RegExp.test(/^\d+$/, value) &&
    parsed->JsNumber.isSafeInteger &&
    parsed >= 0.0 &&
    parsed <= maxInt->Int.toFloat =>
    Some(parsed->Float.toInt)
  | Some(_) | None => None
  }

let parseHexInt = value =>
  if RegExp.test(/^[0-9a-f]+$/i, value) {
    let parsed = parseIntRadix(value, 16)

    parsed->JsNumber.isSafeInteger && parsed >= 0.0 && parsed <= maxInt->Int.toFloat
      ? Some(parsed->Float.toInt)
      : None
  } else {
    None
  }

let parseUtcTime = value => {
  let milliseconds =
    value
    ->String.trim
    ->String.replace(" UTC", "Z")
    ->String.replace(" ", "T")
    ->Date.fromString
    ->Date.getTime

  milliseconds->Float.isFinite ? Some(Math.floor(milliseconds /. 1000.0)) : None
}

let parseBlock = raw =>
  switch (
    parseDecimalInt(raw.height),
    parseHexInt(raw.version),
    parseUtcTime(raw.time),
    parseDecimalInt(raw.nTx),
  ) {
  | (Some(height), Some(version), Some(time), Some(nTx))
    if RegExp.test(/^[0-9a-f]{64}$/i, raw.hash) =>
    Some(
      (
        {
          hash: raw.hash,
          height,
          nTx,
          signaling: raw.status === "sig",
          time,
          version,
        }: Monitor.unclassifiedMonitorBlock
      ),
    )
  | _ => None
  }

let parseUpdatedAt = value =>
  value
  ->Nullable.toOption
  ->Option.flatMap(parseUtcTime)
  ->Option.map(seconds => (seconds *. 1000.0)->Date.fromTime->Date.toISOString)

let extractRawBlocks = html => {
  let pattern = /<div class="block-tile\s+(sig|nosig)(?:\s+[^"]*)?"\s+data-height="(\d+)"\s+data-hash="([0-9a-fA-F]{64})"\s+data-version="0x([0-9a-fA-F]+)"\s+data-time="([^"]+)"\s+data-ntx="(\d+)">/g
  let blocks: ref<array<rawBlock>> = ref([])

  let rec readNext = () => {
    switch pattern->RegExp.exec(html) {
    | Some(result) =>
      switch result->RegExp.Result.matches->Array.keepSome {
      | [status, height, hash, version, time, nTx] =>
        blocks.contents =
          blocks.contents->Array.concat([{status, height, hash, version, time, nTx}])
      | _ => ()
      }
      readNext()
    | None => ()
    }
  }

  readNext()
  blocks.contents
}

let extractUpdatedAt = html => {
  let pattern = /Updated:\s*([0-9-]+\s+[0-9:]+\s+UTC)/

  switch pattern->RegExp.exec(html) {
  | Some(result) =>
    switch result->RegExp.Result.matches->Array.keepSome {
    | [updatedAt] => updatedAt->Nullable.make
    | _ => Nullable.null
    }
  | None => Nullable.null
  }
}

@genType
let fromExtracted = (rawBlocks, rawUpdatedAt, fallbackUpdatedAt) => {
  blocks: rawBlocks->Array.filterMap(parseBlock),
  updatedAt: parseUpdatedAt(rawUpdatedAt)->Option.getOr(fallbackUpdatedAt),
}

@genType
let fromHtml = (html, fallbackUpdatedAt) =>
  fromExtracted(extractRawBlocks(html), extractUpdatedAt(html), fallbackUpdatedAt)
