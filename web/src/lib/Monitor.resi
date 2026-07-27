/** Signaling summary for one difficulty adjustment period */
@genType
type monitorPeriod = {
  periodNum: int,
  startBlock: int,
  endBlock: int,
  signalingCount: int,
  totalBlocks: int,
  pct: float,
}

/** Normalized monitor snapshot consumed by browser and Worker renderers */
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

/** Block details discovered from an upstream monitor */
@genType
type unclassifiedMonitorBlock = {
  hash: string,
  height: int,
  nTx: int,
  signaling: bool,
  time: float,
  version: int,
}

/** Mining attribution reported by a block explorer */
@genType
type blockMiningAttribution = {
  poolName: string,
  poolSlug: Nullable.t<string>,
  templateMinerName: Nullable.t<string>,
}

/** Wire status for signaling-miner discovery */
@genType
type minerDiscoveryStatus = [#identified | #unidentified | #unavailable]

/** Wire representation of signaling-miner discovery */
@genType
type signalingMinerDiscoveryWire = {
  status: minerDiscoveryStatus,
  attribution?: blockMiningAttribution,
  firstSignal?: bool,
}

/** Wire status for BIP-110 violation classification */
@genType
type violationStatus = [#known | #unavailable]

/** Wire representation of BIP-110 violation classification */
@genType
type bip110ViolationStatusWire = {
  status: violationStatus,
  count?: int,
}

/** Known BIP-110 violation status */
@genType
type knownViolationStatus = [#known]

/** Known BIP-110 violation count */
@genType
type knownBip110ViolationWire = {
  status: knownViolationStatus,
  count: int,
}

/** BIP-110 violation data attributed to one block */
@genType
type bip110BlockViolationReport = {
  hash: string,
  height: int,
  violations: knownBip110ViolationWire,
}

/** Classified block represented for JavaScript consumers */
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

/** Parsed wire payload returned by the monitor-blocks API */
@genType
type monitorBlocksPayload = {
  blocks: array<monitorBlockWire>,
  updatedAt: string,
}

/** Availability of block data in a monitor grid cell */
@genType
type gridBlockKind = [#known | #placeholder]

/** Grid cell represented for JavaScript consumers */
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

/** Number of blocks in one difficulty-adjustment period */
@genType
let periodSize: int

/** Number of recent blocks shown before the grid is expanded */
@genType
let monitorGridVisibleBlocks: int

/** Parses and normalizes an external monitor snapshot */
@genType
let parseMonitorData: JSON.t => monitorData

/** Parses an external monitor-blocks payload */
@genType
let parseMonitorBlocksPayload: JSON.t => monitorBlocksPayload

/** Parses mining attribution from a mempool-compatible block response */
@genType
let parseBlockMiningAttribution: JSON.t => Nullable.t<blockMiningAttribution>

/** Parses a block's BIP-110 violation count */
@genType
let parseBip110BlockViolationReport: JSON.t => bip110BlockViolationReport

/** Returns whether a classified block has zero BIP-110 violations */
@genType
let isCleanMonitorBlock: JSON.t => bool

/** Returns whether a grid block is a miner's first identified signal */
@genType
let isFirstMinerSignal: JSON.t => bool

/** Returns the stable identity used to track a miner's first signal */
@genType
let signalingMinerId: blockMiningAttribution => Nullable.t<string>

/** Checks the range invariants enforced for monitor snapshots */
@genType
let isReasonableMonitorData: monitorData => bool

/** Builds current-period grid cells with explicit known and placeholder states */
@genType
let currentPeriodGrid: (
  monitorData,
  Nullable.t<array<monitorBlockWire>>,
) => array<monitorGridBlockWire>

/** Builds a current-period snapshot from contiguous block summaries */
@genType
let monitorDataFromBlocks: (array<unclassifiedMonitorBlock>, string, Nullable.t<int>) => monitorData
