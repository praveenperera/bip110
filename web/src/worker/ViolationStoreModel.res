@genType
type blockReference = {
  hash: string,
  height: float,
}

@genType
type storedReport = {
  count: float,
  hash: string,
  height: float,
}

@genType
type periodBlocks<'block> = {
  blocks: array<'block>,
  periodStart: float,
}

@genType
type knownViolation = {
  status: [#known],
  count: float,
}

@genType
type monitorViolationReport = {
  hash: string,
  height: float,
  violations: knownViolation,
}

@genType
type refreshSelection = {
  reports: array<Monitor.bip110BlockViolationReport>,
  remainingBlocks: array<Monitor.unclassifiedMonitorBlock>,
}

let maxBlocksPerRequest = 144
let periodSize = Monitor.periodSize->Int.toFloat
@genType let violationPageSize = 15
@genType let maxDirectRequests = violationPageSize
@genType let reconstructionsPerRefresh = 1

let invalid = message => JsError.throwWithMessage(message)

let isNonNegativeSafeInteger = value => value->JsNumber.isSafeInteger && value >= 0.0

@genType
let periodStart = height => {
  if !isNonNegativeSafeInteger(height) {
    invalid("violation block height must be a non-negative integer")
  }

  Math.floor(height /. periodSize) *. periodSize
}

@genType
let groupBlocksByPeriod = (blocks, heightOf) => {
  let groups: Map.t<float, array<'block>> = Map.make()

  blocks->Array.forEach(block => {
    let start = periodStart(heightOf(block))
    let periodBlocks = groups->Map.get(start)->Option.getOr([])
    groups->Map.set(start, periodBlocks->Array.concat([block]))
  })

  groups
  ->Map.entries
  ->Iterator.toArray
  ->Array.map(entry => {
    let (periodStart, blocks) = entry
    {blocks, periodStart}
  })
}

@genType
let missingBlocks = (blocks, reports: array<storedReport>, hashOf) => {
  let verifiedHashes = reports->Array.map(report => report.hash)
  blocks->Array.filter(block => !Array.includes(verifiedHashes, hashOf(block)))
}

@genType
let monitorReport = (report: storedReport): monitorViolationReport => {
  hash: report.hash,
  height: report.height,
  violations: {
    status: #known,
    count: report.count,
  },
}

@genType
let violationPageHeights = (blocks: array<Monitor.unclassifiedMonitorBlock>) => {
  let heights = ref([])

  blocks->Array.forEachWithIndex((block, index) => {
    if mod(index, violationPageSize) === 0 {
      heights.contents = heights.contents->Array.concat([block.height])
    }
  })

  heights.contents
}

@genType
let selectAuthoritativeReports = (
  blocks: array<Monitor.unclassifiedMonitorBlock>,
  reports: array<Monitor.bip110BlockViolationReport>,
): refreshSelection => {
  let requestedHashes = blocks->Array.map(block => block.hash)
  let selectedReports =
    reports->Array.filter(report =>
      Array.includes(requestedHashes, report.hash) &&
      Bip110Violations.isAuthoritativeKilombinoViolationReport(report)
    )
  let selectedHashes = selectedReports->Array.map(report => report.hash)

  {
    reports: selectedReports,
    remainingBlocks: blocks->Array.filter(block => !Array.includes(selectedHashes, block.hash)),
  }
}

@genType
let storedReports = (reports: array<Monitor.bip110BlockViolationReport>) =>
  reports->Array.map(report => {
    count: report.violations.count->Int.toFloat,
    hash: report.hash,
    height: report.height->Int.toFloat,
  })

let validatePeriodStart = start => {
  if !isNonNegativeSafeInteger(start) || periodStart(start) !== start {
    invalid("violation period start is invalid")
  }
}

let validateBlock = (start, hash, height) => {
  if !RegExp.test(/^[0-9a-f]{64}$/, hash) {
    invalid("violation block hash is invalid")
  }

  if !isNonNegativeSafeInteger(height) || periodStart(height) !== start {
    invalid("violation block is outside its difficulty period")
  }
}

let validateRequestSize = (length, emptyAllowed, label) => {
  if (!emptyAllowed && length === 0) || length > maxBlocksPerRequest {
    invalid(`violation ${label} size is invalid`)
  }
}

let validateUnique = (hashes, heights, hash, height, label) => {
  if Array.includes(hashes, hash) || Array.includes(heights, height) {
    invalid(`violation ${label} contains duplicates`)
  }
}

@genType
let validateBlocks = (start, blocks: array<blockReference>) => {
  validatePeriodStart(start)
  validateRequestSize(blocks->Array.length, false, "block request")
  let hashes = ref([])
  let heights = ref([])

  let validated = blocks->Array.map(block => {
    validateBlock(start, block.hash, block.height)
    validateUnique(hashes.contents, heights.contents, block.hash, block.height, "block request")
    hashes.contents = hashes.contents->Array.concat([block.hash])
    heights.contents = heights.contents->Array.concat([block.height])
    {hash: block.hash, height: block.height}
  })

  validated->Array.toSorted((left, right) => Float.compare(right.height, left.height))
}

@genType
let validateReports = (start, reports: array<storedReport>) => {
  validatePeriodStart(start)
  validateRequestSize(reports->Array.length, true, "report request")
  let hashes = ref([])
  let heights = ref([])

  reports->Array.map(report => {
    validateBlock(start, report.hash, report.height)

    if !isNonNegativeSafeInteger(report.count) {
      invalid("violation count must be a non-negative integer")
    }

    validateUnique(hashes.contents, heights.contents, report.hash, report.height, "report request")
    hashes.contents = hashes.contents->Array.concat([report.hash])
    heights.contents = heights.contents->Array.concat([report.height])
    {count: report.count, hash: report.hash, height: report.height}
  })
}

@genType
let isRefreshToken = token =>
  RegExp.test(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, token)
