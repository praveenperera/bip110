let versionBitsTopMask = -536_870_912
let versionBitsTopBits = 536_870_912
let bip110VersionBitMask = Int.shiftLeft(1, 4)

let fail = message => JsError.throwWithMessage(message)
let isPositiveSafeInteger = value => value->JsNumber.isSafeInteger && value > 0.0

@scope("Promise") @val
external promiseAll: array<promise<'value>> => promise<array<'value>> = "all"

let requiredField = (object, fieldName, message) =>
  switch object->Dict.get(fieldName) {
  | Some(value) => value
  | None => fail(message)
  }

let stringField = (object, fieldName) =>
  switch object->requiredField(fieldName, `mempool block field ${fieldName} must be a string`) {
  | JSON.String(value) => value
  | _ => fail(`mempool block field ${fieldName} must be a string`)
  }

let integerField = (object, fieldName) =>
  switch object->requiredField(fieldName, `mempool block field ${fieldName} must be an integer`) {
  | JSON.Number(value) if JsNumber.isSafeInteger(value) => value->Float.toInt
  | _ => fail(`mempool block field ${fieldName} must be an integer`)
  }

let nonNegativeIntegerField = (object, fieldName) => {
  let value = object->integerField(fieldName)

  if value < 0 {
    fail(`mempool block field ${fieldName} must be a non-negative integer`)
  }

  value
}

let nonNegativeSafeNumberField = (object, fieldName) =>
  switch object->requiredField(
    fieldName,
    `mempool block field ${fieldName} must be a non-negative integer`,
  ) {
  | JSON.Number(value) if JsNumber.isSafeInteger(value) && value >= 0.0 => value
  | _ => fail(`mempool block field ${fieldName} must be a non-negative integer`)
  }

@genType
let isBip110SignalingVersion = version =>
  Int.bitwiseAnd(version, versionBitsTopMask) === versionBitsTopBits &&
    Int.bitwiseAnd(version, bip110VersionBitMask) !== 0

@genType
let parseMempoolBlock = value =>
  switch value {
  | JSON.Object(object) =>
    let hash = object->stringField("id")

    if !RegExp.test(/^[0-9a-f]{64}$/i, hash) {
      fail("mempool block id must be a block hash")
    }

    let version = object->integerField("version")

    let block: Monitor.unclassifiedMonitorBlock = {
      hash,
      height: object->nonNegativeIntegerField("height"),
      nTx: object->nonNegativeIntegerField("tx_count"),
      signaling: isBip110SignalingVersion(version),
      time: object->nonNegativeSafeNumberField("timestamp"),
      version,
    }

    block
  | _ => fail("mempool block response must be an object")
  }

@genType
let validateBlockRange = (startHeight, limit) => {
  if startHeight <= 0 {
    fail("mempool block start height is invalid")
  }
  if limit <= 0 || limit > Monitor.periodSize {
    fail("mempool block limit is invalid")
  }
}

@genType
let parsePositiveHeight = value =>
  if RegExp.test(/^[0-9]+$/, value) {
    switch value->Int.fromString {
    | Some(height) if height > 0 => Nullable.make(height)
    | _ => Nullable.null
    }
  } else {
    Nullable.null
  }

@genType
let validateTransactionRequest = (hash, transactionCount) => {
  if !RegExp.test(/^[0-9a-f]{64}$/i, hash) {
    fail("block transaction request hash is invalid")
  }
  if !isPositiveSafeInteger(transactionCount) {
    fail("block transaction request count is invalid")
  }
}

@genType
let descendingPageStarts = (startHeight, limit, pageSize) => {
  let starts = []
  let minimumExclusive = startHeight - limit
  let next = ref(startHeight)

  while next.contents > minimumExclusive {
    starts->Array.push(next.contents)->ignore
    next.contents = next.contents - pageSize
  }

  starts
}

@genType
let ascendingPageStarts = (count, pageSize) => {
  let starts = []
  let next = ref(0)

  while next.contents < count {
    starts->Array.push(next.contents)->ignore
    next.contents = next.contents + pageSize
  }

  starts
}

@genType
let hasContiguousRange = (
  blocks: array<Monitor.unclassifiedMonitorBlock>,
  startHeight,
  endHeight,
) =>
  blocks->Array.length === endHeight - startHeight + 1 &&
    blocks->Array.everyWithIndex((block, index) => block.height === endHeight - index)

@genType
let uniqueBlocks = (blocks: array<Monitor.unclassifiedMonitorBlock>) => {
  let unique: array<Monitor.unclassifiedMonitorBlock> = []

  blocks
  ->Array.toSorted((left, right) => Int.compare(right.height, left.height))
  ->Array.forEach(block => {
    if !Array.some(unique, existing => existing.height === block.height) {
      unique->Array.push(block)->ignore
    }
  })

  unique
}

@genType
let selectBlockRange = (blocks: array<Monitor.unclassifiedMonitorBlock>, startHeight, limit) => {
  let firstHeight = startHeight - limit + 1
  let minimumHeight = firstHeight > 0 ? firstHeight : 0

  blocks
  ->Array.filter(block => block.height >= minimumHeight && block.height <= startHeight)
  ->uniqueBlocks
  ->Array.slice(~start=0, ~end=limit)
}

@genType
let mapConcurrent = async (values, concurrency, map) => {
  if concurrency <= 0 {
    fail("mempool concurrency must be positive")
  }

  let output = []
  let index = ref(0)

  while index.contents < values->Array.length {
    let batch =
      values
      ->Array.slice(~start=index.contents, ~end=index.contents + concurrency)
      ->Array.map(map)
    let mapped = await promiseAll(batch)
    output->Array.pushMany(mapped)
    index.contents = index.contents + concurrency
  }

  output
}
