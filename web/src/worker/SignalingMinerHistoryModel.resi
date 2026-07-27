/** Minimal signaling block data sent across the Durable Object RPC boundary */
@genType
type signalingBlockReference = {
  hash: string,
  height: int,
}

/** Persistent or newly discovered classification for one signaling block */
@genType
type signalingBlockClassification = {
  discovery: Monitor.signalingMinerDiscoveryWire,
  hash: string,
}

/** Required action for upgrading persisted signaling history to schema v3 */
@genType
type schemaUpgrade = [#current | #recordVersion3 | #addCheckedAt | #rebuildLegacy]

/** First known signal for one identified miner before live history storage */
@genType
type historicalFirstSignal = {
  attribution: Monitor.blockMiningAttribution,
  height: int,
}

/** Maximum signaling blocks accepted for one difficulty-adjustment period */
@genType
let maxPeriodSignals: int

/** Maximum missing block attributions fetched during one classification call */
@genType
let maxDiscoveriesPerCall: int

/** Maximum block attribution requests started concurrently */
@genType
let discoveryConcurrency: int

/** Delay before retrying an unresolved signaling block */
@genType
let unresolvedRetryMs: float

/** Immutable first signals that predate persistent live tracking */
@genType
let historicalFirstSignals: array<historicalFirstSignal>

/** Stable miner identity for a historical first signal */
@genType
let historicalSignalingMinerId: historicalFirstSignal => string

/** Validates, deduplicates, and orders current-period signaling blocks */
@genType
let validatedSignalingBlocks: (
  int,
  array<signalingBlockReference>,
) => array<signalingBlockReference>

/** Whether an unresolved stored classification has reached its retry age */
@genType
let shouldRetryUnresolved: (~checkedAt: float, ~now: float) => bool

/** Selects and partitions missing blocks for bounded concurrent discovery */
@genType
let discoveryBatches: array<signalingBlockReference> => array<array<signalingBlockReference>>

/** Returns signaling blocks that have no stored classification */
@genType
let missingBlocks: (
  array<signalingBlockReference>,
  array<signalingBlockClassification>,
) => array<signalingBlockReference>

/** Joins stored and new classifications in requested block order */
@genType
let classifications: (
  array<signalingBlockReference>,
  array<signalingBlockClassification>,
  array<signalingBlockClassification>,
) => array<signalingBlockClassification>

/** Plans an idempotent checked-at schema upgrade from persisted metadata */
@genType
let schemaUpgrade: (int, array<string>) => schemaUpgrade
