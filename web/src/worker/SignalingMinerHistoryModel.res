@genType
type signalingBlockReference = {
  hash: string,
  height: int,
}

@genType
type signalingBlockClassification = {
  discovery: Monitor.signalingMinerDiscoveryWire,
  hash: string,
}

@genType
type schemaUpgrade = [#current | #recordVersion3 | #addCheckedAt | #rebuildLegacy]

@genType
type historicalFirstSignal = {
  attribution: Monitor.blockMiningAttribution,
  height: int,
}

@genType
let maxPeriodSignals = 2016

@genType
let maxDiscoveriesPerCall = 40

@genType
let discoveryConcurrency = 8

@genType
let unresolvedRetryMs =
  60.0 *. 60.0 *. 1000.0

let oceanSignal = (height, templateMinerName): historicalFirstSignal => {
  attribution: {
    poolName: "OCEAN",
    poolSlug: "ocean"->Nullable.make,
    templateMinerName: templateMinerName->Nullable.make,
  },
  height,
}

@genType
let historicalFirstSignals = [
  oceanSignal(938903, "Barefoot Mining"),
  oceanSignal(942721, "234 Alberta"),
  oceanSignal(950356, "SoV"),
  oceanSignal(951929, "Roughnecks"),
  oceanSignal(951972, "Peer to Peer Money"),
  oceanSignal(952680, "BIP110"),
  oceanSignal(956740, "Sazmining"),
  oceanSignal(957110, "Crestmont Fabrics Ltd"),
  oceanSignal(957482, "Datum Miner"),
  oceanSignal(958831, "SpammersGFY"),
  oceanSignal(959143, "888"),
  oceanSignal(959199, "Moonwalk"),
  oceanSignal(959449, "PyBLOCKDatum"),
  oceanSignal(959562, "Just For Krypto"),
  oceanSignal(959614, "JAMIN"),
]

@genType
let historicalSignalingMinerId = signal => {
  switch Monitor.signalingMinerId(signal.attribution)->Nullable.toOption {
  | Some(minerId) => minerId
  | None =>
    JsError.throwWithMessage(
      `historical signal at height ${signal.height->Int.toString} has no miner identity`,
    )
  }
}

@genType
let validatedSignalingBlocks = (periodStart, blocks: array<signalingBlockReference>) => {
  if !JsNumber.isSafeInteger(periodStart->Int.toFloat) || periodStart <= 0 {
    JsError.throwWithMessage("signaling period start is invalid")
  }

  if blocks->Array.length > maxPeriodSignals {
    JsError.throwWithMessage("signaling block list exceeds one period")
  }

  let uniqueBlocks: array<signalingBlockReference> = blocks->Array.reduce([], (
    uniqueBlocks,
    block,
  ) => {
    if (
      !RegExp.test(/^[0-9a-f]{64}$/, block.hash) ||
      !JsNumber.isSafeInteger(block.height->Int.toFloat) ||
      block.height < periodStart ||
      block.height >= periodStart + maxPeriodSignals
    ) {
      JsError.throwWithMessage("signaling block reference is invalid")
    }

    switch uniqueBlocks->Array.find((uniqueBlock: signalingBlockReference) =>
      uniqueBlock.hash === block.hash
    ) {
    | Some(uniqueBlock) if uniqueBlock.height !== block.height =>
      JsError.throwWithMessage("signaling block reference is invalid")
    | Some(_) => uniqueBlocks
    | None =>
      uniqueBlocks->Array.push(block)->ignore
      uniqueBlocks
    }
  })

  uniqueBlocks->Array.toSorted((left, right) => Int.compare(left.height, right.height))
}

@genType
let shouldRetryUnresolved = (~checkedAt, ~now) => now -. checkedAt >= unresolvedRetryMs

@genType
let discoveryBatches = (blocks: array<signalingBlockReference>) => {
  let batches = []
  let selectedBlocks = blocks->Array.slice(~start=0, ~end=maxDiscoveriesPerCall)

  let rec addBatch = start => {
    if start >= selectedBlocks->Array.length {
      ()
    } else {
      batches
      ->Array.push(selectedBlocks->Array.slice(~start, ~end=start + discoveryConcurrency))
      ->ignore
      addBatch(start + discoveryConcurrency)
    }
  }

  addBatch(0)
  batches
}

@genType
let missingBlocks = (
  blocks: array<signalingBlockReference>,
  classifications: array<signalingBlockClassification>,
) => {
  let classifiedHashes = classifications->Array.map(classification => classification.hash)
  blocks->Array.filter(block => !Array.includes(classifiedHashes, block.hash))
}

@genType
let classifications = (
  blocks: array<signalingBlockReference>,
  stored: array<signalingBlockClassification>,
  discovered: array<signalingBlockClassification>,
) => {
  let byHash =
    stored
    ->Array.concat(discovered)
    ->Array.map(classification => (classification.hash, classification.discovery))
    ->Map.fromArray

  blocks->Array.map(block => {
    hash: block.hash,
    discovery: byHash->Map.get(block.hash)->Option.getOr({status: #unavailable}),
  })
}

@genType
let schemaUpgrade = (currentVersion, columns) => {
  if !(columns->Array.includes("status")) {
    #rebuildLegacy
  } else if !(columns->Array.includes("checked_at")) {
    #addCheckedAt
  } else if currentVersion < 3 {
    #recordVersion3
  } else {
    #current
  }
}
