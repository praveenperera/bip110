/** Returns whether a block version uses versionbits signaling for BIP-110 */
@genType
let isBip110SignalingVersion: int => bool

/** Parses a mempool-compatible block summary */
@genType
let parseMempoolBlock: JSON.t => Monitor.unclassifiedMonitorBlock

/** Validates the requested block range */
@genType
let validateBlockRange: (int, int) => unit

/** Strictly parses one positive decimal block height */
@genType
let parsePositiveHeight: string => Nullable.t<int>

/** Validates a block identity and transaction count before provider requests */
@genType
let validateTransactionRequest: (string, float) => unit

/** Returns descending block-page start heights */
@genType
let descendingPageStarts: (int, int, int) => array<int>

/** Returns ascending transaction-page start indexes */
@genType
let ascendingPageStarts: (int, int) => array<int>

/** Returns whether blocks cover every descending height in a range */
@genType
let hasContiguousRange: (array<Monitor.unclassifiedMonitorBlock>, int, int) => bool

/** Deduplicates blocks by height in descending order */
@genType
let uniqueBlocks: array<Monitor.unclassifiedMonitorBlock> => array<Monitor.unclassifiedMonitorBlock>

/** Selects one descending bounded block range */
@genType
let selectBlockRange: (
  array<Monitor.unclassifiedMonitorBlock>,
  int,
  int,
) => array<Monitor.unclassifiedMonitorBlock>

/** Maps values in sequential bounded-concurrency batches */
@genType
let mapConcurrent: (array<'input>, int, 'input => promise<'output>) => promise<array<'output>>
