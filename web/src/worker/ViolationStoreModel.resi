/** Minimal block identity persisted across the Durable Object boundary */
@genType
type blockReference = {
  hash: string,
  height: float,
}

/** Persistent independently verified violation count */
@genType
type storedReport = {
  count: float,
  hash: string,
  height: float,
}

/** Arbitrary blocks grouped under one difficulty-period owner */
@genType
type periodBlocks<'block> = {
  blocks: array<'block>,
  periodStart: float,
}

/** Known violation-count state consumed by monitor classification */
@genType
type knownViolation = {
  status: [#known],
  count: float,
}

/** Stored report normalized for monitor classification */
@genType
type monitorViolationReport = {
  hash: string,
  height: float,
  violations: knownViolation,
}

/** Authoritative reports and blocks left for the next refresh stage */
@genType
type refreshSelection = {
  reports: array<Monitor.bip110BlockViolationReport>,
  remainingBlocks: array<Monitor.unclassifiedMonitorBlock>,
}

/** Number of blocks requested from one Kilombino page */
@genType
let violationPageSize: int

/** Maximum direct Kilombino block requests in one refresh */
@genType
let maxDirectRequests: int

/** Maximum local reconstructions in one refresh */
@genType
let reconstructionsPerRefresh: int

/** Returns the first height owned by a block's difficulty-period store */
@genType
let periodStart: float => float

/** Groups values by the difficulty period returned by their height accessor */
@genType
let groupBlocksByPeriod: (array<'block>, 'block => float) => array<periodBlocks<'block>>

/** Returns values whose hashes have no persisted report */
@genType
let missingBlocks: (array<'block>, array<storedReport>, 'block => string) => array<'block>

/** Converts a stored count into the monitor classification shape */
@genType
let monitorReport: storedReport => monitorViolationReport

/** Returns the first block height for each external violation page */
@genType
let violationPageHeights: array<Monitor.unclassifiedMonitorBlock> => array<int>

/** Keeps matching authoritative reports and returns blocks still unresolved */
@genType
let selectAuthoritativeReports: (
  array<Monitor.unclassifiedMonitorBlock>,
  array<Monitor.bip110BlockViolationReport>,
) => refreshSelection

/** Converts monitor reports into the Durable Object persistence shape */
@genType
let storedReports: array<Monitor.bip110BlockViolationReport> => array<storedReport>

/** Validates, copies, deduplicates, and orders one block request */
@genType
let validateBlocks: (float, array<blockReference>) => array<blockReference>

/** Validates and copies reports before persistence */
@genType
let validateReports: (float, array<storedReport>) => array<storedReport>

/** Returns whether a string is a version-4 UUID refresh token */
@genType
let isRefreshToken: string => bool
