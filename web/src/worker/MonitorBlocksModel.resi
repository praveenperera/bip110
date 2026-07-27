/** Signaling-miner classification keyed by block hash */
@genType
type signalingClassification = {
  hash: string,
  discovery: Monitor.signalingMinerDiscoveryWire,
}

/** Durable Object classification request for signaling blocks in one period */
@genType
type signalingPlan = {
  periodStart: int,
  blocks: array<SignalingMinerHistoryModel.signalingBlockReference>,
}

/** Merges monitor and fallback blocks by height, preferring fallback blocks */
@genType
let mergeBlocks: (
  array<Monitor.unclassifiedMonitorBlock>,
  array<Monitor.unclassifiedMonitorBlock>,
) => array<Monitor.unclassifiedMonitorBlock>

/** Joins miner and violation classifications onto unclassified blocks */
@genType
let classifyBlocks: (
  array<Monitor.unclassifiedMonitorBlock>,
  array<signalingClassification>,
  array<Monitor.bip110BlockViolationReport>,
  string,
) => Monitor.monitorBlocksPayload

/** Selects normal or catch-up caching based on the returned tip */
@genType
let cacheTtl: (
  array<Monitor.monitorBlockWire>,
  Nullable.t<int>,
  ~normalTtl: int,
  ~catchUpTtl: int,
) => int

/** Builds a signaling-history request when signaling blocks are present */
@genType
let signalingPlan: array<Monitor.unclassifiedMonitorBlock> => Nullable.t<signalingPlan>
