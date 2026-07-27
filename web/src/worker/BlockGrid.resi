/** Dashboard interpretation of one block-grid cell */
@genType
type dashboardBlockMode = [#bip110 | #ursf]

/** Dynamic labels and states consumed by the dashboard block view */
@genType
type dashboardBlockPresentation = {
  known: bool,
  signaling: bool,
  clean: bool,
  firstMinerSignal: bool,
  hashLabel: string,
  versionLabel: string,
  timeLabel: string,
  transactionsLabel: string,
  statusLabel: string,
  statusPrefix: string,
  violationCount: Nullable.t<int>,
  violationCountLabel: Nullable.t<string>,
  cleanLabel: Nullable.t<string>,
  firstMinerLabel: Nullable.t<string>,
  title: string,
  hasServerAttribution: bool,
  serverAttribution: Nullable.t<Monitor.blockMiningAttribution>,
}

/** Formats nullable block-mining attribution for the dashboard */
@genType
let blockMinerLabel: Nullable.t<Monitor.blockMiningAttribution> => string

/** Derives dashboard labels and states for one block-grid cell */
@genType
let dashboardBlockPresentation: (
  Monitor.monitorGridBlockWire,
  dashboardBlockMode,
) => dashboardBlockPresentation

/** Renders the BIP-110 current-period block grid */
@genType
let bip110BlockGridHtml: (Monitor.monitorData, array<Monitor.monitorBlockWire>) => string

/** Renders the URSF current-period block grid */
@genType
let ursfBlockGridHtml: (Monitor.monitorData, array<Monitor.monitorBlockWire>) => string

/** Renders a legend item when a visible block is a miner's first signal */
@genType
let bip110FirstSignalLegendHtml: (Monitor.monitorData, array<Monitor.monitorBlockWire>) => string
