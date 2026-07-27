/** Raw block attributes extracted from one monitor-page tile */
@genType
type rawBlock = {
  status: string,
  height: string,
  hash: string,
  version: string,
  time: string,
  nTx: string,
}

/** Validated monitor-page block payload */
@genType
type monitorBlocks = {
  blocks: array<Monitor.unclassifiedMonitorBlock>,
  updatedAt: string,
}

/** Validates extracted monitor-page fields and normalizes timestamps */
@genType
let fromExtracted: (array<rawBlock>, Nullable.t<string>, string) => monitorBlocks

/** Extracts, validates, and normalizes monitor blocks from upstream HTML */
@genType
let fromHtml: (string, string) => monitorBlocks
