@genType
type monitorPeriod = {
  periodNum: int,
  startBlock: int,
  endBlock: int,
  signalingCount: int,
  totalBlocks: int,
  pct: float,
}

@genType
type monitorData = {
  bip: string,
  tip: int,
  chainTip: int,
  periodNum: int,
  periodStart: int,
  periodEnd: int,
  totalBlocks: int,
  signalingCount: int,
  pct: float,
  periods: array<monitorPeriod>,
  synced: bool,
  updatedAt: string,
}

@genType
type unclassifiedMonitorBlock = {
  hash: string,
  height: int,
  nTx: int,
  signaling: bool,
  time: float,
  version: int,
}

@genType
type blockMiningAttribution = {
  poolName: string,
  poolSlug: Nullable.t<string>,
  templateMinerName: Nullable.t<string>,
}

@genType
type minerDiscoveryStatus = [#identified | #unidentified | #unavailable]

@genType
type signalingMinerDiscoveryWire = {
  status: minerDiscoveryStatus,
  attribution?: blockMiningAttribution,
  firstSignal?: bool,
}

@genType
type violationStatus = [#known | #unavailable]

@genType
type bip110ViolationStatusWire = {
  status: violationStatus,
  count?: int,
}

@genType
type knownViolationStatus = [#known]

@genType
type knownBip110ViolationWire = {
  status: knownViolationStatus,
  count: int,
}

@genType
type bip110BlockViolationReport = {
  hash: string,
  height: int,
  violations: knownBip110ViolationWire,
}

@genType
type monitorBlockWire = {
  hash: string,
  height: int,
  nTx: int,
  signaling: bool,
  time: float,
  version: int,
  bip110Violations: bip110ViolationStatusWire,
  signalingMiner: Nullable.t<signalingMinerDiscoveryWire>,
}

@genType
type monitorBlocksPayload = {
  blocks: array<monitorBlockWire>,
  updatedAt: string,
}

@genType
type gridBlockKind = [#known | #placeholder]

@genType
type monitorGridBlockWire = {
  kind: gridBlockKind,
  height: int,
  hash?: string,
  nTx?: int,
  signaling?: bool,
  time?: float,
  version?: int,
  bip110Violations?: bip110ViolationStatusWire,
  signalingMiner?: Nullable.t<signalingMinerDiscoveryWire>,
}

type minerDiscovery =
  | Identified({attribution: blockMiningAttribution, firstSignal: bool})
  | Unidentified
  | MinerUnavailable

type bip110Violation =
  | KnownViolation(int)
  | ViolationUnavailable

type classifiedMonitorBlock =
  | SignalingBlock({
      details: unclassifiedMonitorBlock,
      violations: bip110Violation,
      minerDiscovery: minerDiscovery,
    })
  | NonSignalingBlock({details: unclassifiedMonitorBlock, violations: bip110Violation})

@genType
let periodSize = 2016

@genType
let monitorGridVisibleBlocks = 144

let maxInt = (left, right) => left > right ? left : right

let fail = message => JsError.throwWithMessage(message)

let requiredField = (object, fieldName, errorMessage) => {
  switch object->Dict.get(fieldName) {
  | Some(value) => value
  | None => fail(errorMessage)
  }
}

let stringField = (object, fieldName) => {
  switch object->requiredField(fieldName, `monitor API field ${fieldName} must be a string`) {
  | JSON.String(value) => value
  | _ => fail(`monitor API field ${fieldName} must be a string`)
  }
}

let floatField = (object, fieldName) => {
  switch object->requiredField(fieldName, `monitor API field ${fieldName} must be a number`) {
  | JSON.Number(value) if Float.isFinite(value) => value
  | _ => fail(`monitor API field ${fieldName} must be a number`)
  }
}

let intField = (object, fieldName) => {
  let value = object->floatField(fieldName)

  if !JsNumber.isSafeInteger(value) {
    fail(`monitor API field ${fieldName} must be an integer`)
  }

  value->Float.toInt
}

let nonNegativeIntegerField = (object, fieldName) => {
  let value = object->floatField(fieldName)

  if !JsNumber.isSafeInteger(value) || value < 0.0 {
    fail(`monitor API field ${fieldName} must be a non-negative integer`)
  }

  value->Float.toInt
}

let nonNegativeSafeNumberField = (object, fieldName) => {
  let value = object->floatField(fieldName)

  if !JsNumber.isSafeInteger(value) || value < 0.0 {
    fail(`monitor API field ${fieldName} must be a non-negative integer`)
  }

  value
}

let booleanField = (object, fieldName) => {
  switch object->requiredField(fieldName, `monitor API field ${fieldName} must be a boolean`) {
  | JSON.Boolean(value) => value
  | _ => fail(`monitor API field ${fieldName} must be a boolean`)
  }
}

let optionalNonEmptyString = value => {
  switch value {
  | JSON.String(value) =>
    switch value->String.trim {
    | "" => None
    | value => Some(value)
    }
  | _ => None
  }
}

let nullableStringFromField = (object, fieldName) => {
  object
  ->Dict.get(fieldName)
  ->Option.flatMap(value => optionalNonEmptyString(value))
  ->Nullable.fromOption
}

let monitorPeriodFromJson = value => {
  switch value {
  | JSON.Object(period) => {
      periodNum: period->intField("periodNum"),
      startBlock: period->intField("startBlock"),
      endBlock: period->intField("endBlock"),
      signalingCount: period->intField("signalingCount"),
      totalBlocks: period->intField("totalBlocks"),
      pct: period->floatField("pct"),
    }
  | _ => fail("monitor API period must be an object")
  }
}

let periodsField = object => {
  switch object->Dict.get("periods") {
  | Some(JSON.Array(periods)) => periods->Array.map(monitorPeriodFromJson)
  | _ => []
  }
}

let isReasonableMonitorPeriod = (period: monitorPeriod) =>
  period.periodNum > 0 &&
  period.startBlock > 0 &&
  period.endBlock >= period.startBlock &&
  period.totalBlocks >= 0 &&
  period.totalBlocks <= periodSize &&
  period.signalingCount >= 0 &&
  period.signalingCount <= period.totalBlocks &&
  period.pct >= 0.0 &&
  period.pct <= 100.0

let normalizedMonitorPeriods = (data: monitorData) => {
  let currentPeriod = {
    periodNum: data.periodNum,
    startBlock: data.periodStart,
    endBlock: data.periodEnd,
    signalingCount: data.signalingCount,
    totalBlocks: data.totalBlocks,
    pct: data.pct,
  }
  let previousPeriods =
    data.periods
    ->Array.filter(period => period.periodNum !== data.periodNum)
    ->Array.toSorted((left, right) => Int.compare(right.periodNum, left.periodNum))

  Array.concat([currentPeriod], previousPeriods)
}

let isReasonableMonitorDataValue = data =>
  data.tip > 0 &&
  data.chainTip > 0 &&
  data.periodNum > 0 &&
  data.periodStart > 0 &&
  data.periodEnd >= data.periodStart &&
  data.totalBlocks >= 0 &&
  data.totalBlocks <= periodSize &&
  data.signalingCount >= 0 &&
  data.signalingCount <= data.totalBlocks &&
  data.pct >= 0.0 &&
  data.pct <= 100.0 &&
  data.periods->Array.every(isReasonableMonitorPeriod) &&
  data.updatedAt->String.length > 0

let monitorDataFromJson = (value: JSON.t): monitorData => {
  let data = switch value {
  | JSON.Object(object) => {
      bip: object->stringField("bip"),
      tip: object->intField("tip"),
      chainTip: object->intField("chainTip"),
      periodNum: object->intField("periodNum"),
      periodStart: object->intField("periodStart"),
      periodEnd: object->intField("periodEnd"),
      totalBlocks: object->intField("totalBlocks"),
      signalingCount: object->intField("signalingCount"),
      pct: object->floatField("pct"),
      periods: object->periodsField,
      synced: object->booleanField("synced"),
      updatedAt: object->stringField("updatedAt"),
    }
  | _ => fail("monitor API response must be an object")
  }
  let normalizedData = {...data, periods: normalizedMonitorPeriods(data)}

  if !isReasonableMonitorDataValue(normalizedData) {
    fail("monitor API response contains invalid values")
  }

  normalizedData
}

let violationFromJson = value => {
  switch value {
  | None => ViolationUnavailable
  | Some(JSON.Object(object)) =>
    switch object->stringField("status") {
    | "unavailable" => ViolationUnavailable
    | "known" => KnownViolation(object->nonNegativeIntegerField("count"))
    | _ => fail("monitor block API violation status is invalid")
    }
  | Some(_) => fail("monitor block API violation status must be an object")
  }
}

let attributionFromJsonObject = object => {
  poolName: object->stringField("poolName"),
  poolSlug: object->nullableStringFromField("poolSlug"),
  templateMinerName: object->nullableStringFromField("templateMinerName"),
}

let minerDiscoveryFromJson = value => {
  switch value {
  | JSON.Object(object) =>
    switch object->stringField("status") {
    | "unidentified" => Unidentified
    | "unavailable" => MinerUnavailable
    | "identified" =>
      let attribution = switch object->Dict.get("attribution") {
      | Some(JSON.Object(attribution)) => attributionFromJsonObject(attribution)
      | _ => fail("monitor block API identified miner is invalid")
      }

      Identified({
        attribution,
        firstSignal: object->booleanField("firstSignal"),
      })
    | _ => fail("monitor block API miner discovery status is invalid")
    }
  | _ => fail("monitor block API signaling block must have miner discovery")
  }
}

let classifiedMonitorBlockFromJson = value => {
  switch value {
  | JSON.Object(object) =>
    let violations = object->Dict.get("bip110Violations")->violationFromJson
    let hash = object->stringField("hash")
    let height = object->intField("height")
    let nTx = object->intField("nTx")
    let signaling = object->booleanField("signaling")
    let time = object->nonNegativeSafeNumberField("time")
    let version = object->intField("version")
    let details: unclassifiedMonitorBlock = {
      hash,
      height,
      nTx,
      signaling,
      time,
      version,
    }
    let signalingMiner = object->Dict.get("signalingMiner")

    if signaling {
      switch signalingMiner {
      | Some(value) =>
        SignalingBlock({
          details,
          violations,
          minerDiscovery: minerDiscoveryFromJson(value),
        })
      | None => fail("monitor block API signaling block must have miner discovery")
      }
    } else {
      switch signalingMiner {
      | Some(JSON.Null) => NonSignalingBlock({details, violations})
      | _ => fail("monitor block API non-signaling block must not have miner discovery")
      }
    }
  | _ => fail("monitor block API block must be an object")
  }
}

let violationFromWire = (violation: bip110ViolationStatusWire) => {
  switch violation.status {
  | #unavailable => ViolationUnavailable
  | #known =>
    switch violation.count {
    | Some(count) if count >= 0 => KnownViolation(count)
    | _ => fail("monitor block API known violation status must have a count")
    }
  }
}

let minerDiscoveryFromWire = (discovery: signalingMinerDiscoveryWire) => {
  switch discovery.status {
  | #unidentified => Unidentified
  | #unavailable => MinerUnavailable
  | #identified =>
    switch (discovery.attribution, discovery.firstSignal) {
    | (Some(attribution), Some(firstSignal)) => Identified({attribution, firstSignal})
    | _ => fail("monitor block API identified miner is invalid")
    }
  }
}

let classifiedMonitorBlockFromWire = (block: monitorBlockWire) => {
  let details: unclassifiedMonitorBlock = {
    hash: block.hash,
    height: block.height,
    nTx: block.nTx,
    signaling: block.signaling,
    time: block.time,
    version: block.version,
  }
  let violations = violationFromWire(block.bip110Violations)

  if block.signaling {
    switch block.signalingMiner->Nullable.toOption {
    | Some(discovery) =>
      SignalingBlock({details, violations, minerDiscovery: minerDiscoveryFromWire(discovery)})
    | None => fail("monitor block API signaling block must have miner discovery")
    }
  } else {
    switch block.signalingMiner->Nullable.toOption {
    | None => NonSignalingBlock({details, violations})
    | Some(_) => fail("monitor block API non-signaling block must not have miner discovery")
    }
  }
}

let violationToWire = (violation): bip110ViolationStatusWire => {
  switch violation {
  | KnownViolation(count) => {status: #known, count}
  | ViolationUnavailable => {status: #unavailable}
  }
}

let minerDiscoveryToWire = (discovery): signalingMinerDiscoveryWire => {
  switch discovery {
  | Identified({attribution, firstSignal}) => {status: #identified, attribution, firstSignal}
  | Unidentified => {status: #unidentified}
  | MinerUnavailable => {status: #unavailable}
  }
}

let classifiedMonitorBlockToWire = (block): monitorBlockWire => {
  switch block {
  | SignalingBlock({details, violations, minerDiscovery}) => {
      hash: details.hash,
      height: details.height,
      nTx: details.nTx,
      signaling: true,
      time: details.time,
      version: details.version,
      bip110Violations: violationToWire(violations),
      signalingMiner: minerDiscoveryToWire(minerDiscovery)->Nullable.make,
    }
  | NonSignalingBlock({details, violations}) => {
      hash: details.hash,
      height: details.height,
      nTx: details.nTx,
      signaling: false,
      time: details.time,
      version: details.version,
      bip110Violations: violationToWire(violations),
      signalingMiner: Nullable.null,
    }
  }
}

let knownGridBlockToWire = (block): monitorGridBlockWire => {
  let wire = classifiedMonitorBlockToWire(block)

  {
    kind: #known,
    height: wire.height,
    hash: wire.hash,
    nTx: wire.nTx,
    signaling: wire.signaling,
    time: wire.time,
    version: wire.version,
    bip110Violations: wire.bip110Violations,
    signalingMiner: wire.signalingMiner,
  }
}

@genType
let parseMonitorData = value => monitorDataFromJson(value)

@genType
let parseMonitorBlocksPayload = value => {
  switch value {
  | JSON.Object(object) =>
    let blocks = switch object->Dict.get("blocks") {
    | Some(JSON.Array(blocks)) =>
      blocks->Array.map(value =>
        value->classifiedMonitorBlockFromJson->classifiedMonitorBlockToWire
      )
    | _ => fail("monitor block API field blocks must be an array")
    }

    {
      blocks,
      updatedAt: object->stringField("updatedAt"),
    }
  | _ => fail("monitor block API response must be an object")
  }
}

@genType
let parseBlockMiningAttribution = value => {
  switch value {
  | JSON.Object(object) =>
    switch object->Dict.get("extras") {
    | Some(JSON.Object(extras)) =>
      switch extras->Dict.get("pool") {
      | Some(JSON.Object(pool)) =>
        switch pool->Dict.get("name")->Option.flatMap(value => optionalNonEmptyString(value)) {
        | None => Nullable.null
        | Some(poolName) =>
          let poolSlug = pool->nullableStringFromField("slug")
          let templateMinerName = if poolName === "OCEAN" {
            switch pool->Dict.get("minerNames") {
            | Some(JSON.Array(minerNames)) =>
              minerNames
              ->Array.get(1)
              ->Option.flatMap(value => optionalNonEmptyString(value))
              ->Nullable.fromOption
            | _ => Nullable.null
            }
          } else {
            Nullable.null
          }

          Nullable.make({poolName, poolSlug, templateMinerName})
        }
      | _ => Nullable.null
      }
    | _ => Nullable.null
    }
  | _ => fail("block explorer response must be an object")
  }
}

@genType
let parseBip110BlockViolationReport = value => {
  switch value {
  | JSON.Object(object) =>
    let hash = object->stringField("id")
    if !RegExp.test(/^[0-9a-f]{64}$/i, hash) {
      fail("BIP-110 block response id must be a block hash")
    }
    let height = object->nonNegativeIntegerField("height")
    let extras = switch object->Dict.get("extras") {
    | Some(JSON.Object(extras)) => extras
    | _ => fail("BIP-110 block response extras must be an object")
    }

    {
      hash,
      height,
      violations: {
        status: #known,
        count: extras->nonNegativeIntegerField("bip110ViolationCount"),
      },
    }
  | _ => fail("BIP-110 block response must be an object")
  }
}

@genType
let isCleanMonitorBlock = value => {
  switch classifiedMonitorBlockFromJson(value) {
  | SignalingBlock({violations: KnownViolation(0)})
  | NonSignalingBlock({violations: KnownViolation(0)}) => true
  | SignalingBlock(_)
  | NonSignalingBlock(_) => false
  }
}

@genType
let isFirstMinerSignal = value => {
  switch value {
  | JSON.Object(object) =>
    switch object->Dict.get("kind") {
    | Some(JSON.String("known")) =>
      switch classifiedMonitorBlockFromJson(value) {
      | SignalingBlock({minerDiscovery: Identified({firstSignal: true})}) => true
      | SignalingBlock(_)
      | NonSignalingBlock(_) => false
      }
    | _ => false
    }
  | _ => false
  }
}

let normalizedMinerIdentityPart = value =>
  value
  ->String.trim
  ->String.replaceAllRegExp(/\s+/g, " ")
  ->String.toLocaleLowerCase

@genType
let signalingMinerId = attribution => {
  let poolId =
    attribution.poolSlug
    ->Nullable.toOption
    ->Option.getOr(attribution.poolName)
    ->normalizedMinerIdentityPart

  if poolId === "" || poolId === "unknown" {
    Nullable.null
  } else if poolId !== "ocean" {
    Nullable.make(poolId)
  } else {
    switch attribution.templateMinerName
    ->Nullable.toOption
    ->Option.map(normalizedMinerIdentityPart) {
    | Some(templateMinerId) if templateMinerId !== "" =>
      Nullable.make(`${poolId}:${templateMinerId}`)
    | _ => Nullable.null
    }
  }
}

@genType
let isReasonableMonitorData = data => isReasonableMonitorDataValue(data)

@genType
let currentPeriodGrid = (data, blocks) => {
  let blocksByHeight =
    blocks
    ->Nullable.toOption
    ->Option.getOr([])
    ->Array.map(block => {
      let classified = classifiedMonitorBlockFromWire(block)
      (block.height, classified)
    })
    ->Map.fromArray
  let firstHeight = maxInt(data.periodStart, data.tip - data.totalBlocks + 1)
  let blockCount = maxInt(data.tip - firstHeight + 1, 0)

  Array.fromInitializer(~length=blockCount, index => {
    let height = data.tip - index

    switch blocksByHeight->Map.get(height) {
    | Some(block) => knownGridBlockToWire(block)
    | None => {kind: #placeholder, height}
    }
  })
}

@genType
let monitorDataFromBlocks = (
  blocks: array<unclassifiedMonitorBlock>,
  updatedAt,
  expectedTip: Nullable.t<int>,
) => {
  let inferredTip = blocks->Array.reduce(0, (tip, block) => maxInt(tip, block.height))
  let tip = expectedTip->Nullable.toOption->Option.getOr(inferredTip)

  if tip <= 0 {
    fail("monitor fallback blocks contain no valid tip")
  }

  let periodNum = tip / periodSize
  let periodStart = periodNum * periodSize
  let periodEnd = periodStart + periodSize - 1
  let periodBlocks =
    blocks
    ->Array.filter(block => block.height >= periodStart && block.height <= tip)
    ->Array.toSorted((left, right) => Int.compare(right.height, left.height))
  let totalBlocks = tip - periodStart + 1

  if (
    periodBlocks->Array.length !== totalBlocks ||
      periodBlocks->Array.someWithIndex((block, index) => block.height !== tip - index)
  ) {
    fail("monitor fallback blocks do not cover the current period")
  }

  let signalingCount =
    periodBlocks
    ->Array.filter(block => block.signaling)
    ->Array.length
  let rawData = {
    bip: "110",
    tip,
    chainTip: tip,
    periodNum,
    periodStart,
    periodEnd,
    totalBlocks,
    signalingCount,
    pct: totalBlocks === 0 ? 0.0 : signalingCount->Int.toFloat /. totalBlocks->Int.toFloat *. 100.0,
    periods: [],
    synced: true,
    updatedAt,
  }
  let data = {...rawData, periods: normalizedMonitorPeriods(rawData)}

  if !isReasonableMonitorDataValue(data) {
    fail("monitor API response contains invalid values")
  }

  data
}
