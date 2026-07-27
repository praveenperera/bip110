/** Client-side mining-attribution request state */
@genType
type attributionState = {
  status: [#idle | #loading | #loaded | #unavailable],
  attribution: Nullable.t<Monitor.blockMiningAttribution>,
}

/** Selected period-chart metric and its transition */
type chartMetricController = {
  metric: MonitorDashboardModel.periodChartMetric,
  selectMetric: MonitorDashboardModel.periodChartMetric => unit,
}

/** URL-backed recent-window selection and its transition */
type recentWindowController = {
  window: RecentSignaling.window,
  selectWindow: RecentSignaling.window => unit,
}

/** Expansion state for one monitor block grid */
type gridExpansionController = {
  showAll: bool,
  showAllBlocks: unit => unit,
}

/** Lazy block-attribution state shared across the current grid */
type blockAttributionController = {
  attributionForHash: string => attributionState,
  loadAttribution: string => unit,
}

/** Interactive state and actions for one monitor block grid */
type gridController = {
  showAllBlocks: bool,
  expandBlocks: unit => unit,
  attributionState: string => attributionState,
  loadAttribution: string => unit,
}

/** Interactive state and actions for the full monitor dashboard */
type dashboardController = {
  now: float,
  chartMetric: MonitorDashboardModel.periodChartMetric,
  selectChartMetric: MonitorDashboardModel.periodChartMetric => unit,
  recentWindow: RecentSignaling.window,
  selectRecentWindow: RecentSignaling.window => unit,
  grid: gridController,
}

/** Returns an epoch-millisecond clock updated once per second */
let useClock: unit => float

/** Owns the selected period-chart metric */
let useChartMetric: unit => chartMetricController

/** Owns the URL-backed recent-signaling window */
let useRecentWindow: unit => recentWindowController

/** Owns grid expansion and resets it when the grid identity changes */
let useGridExpansion: (~periodNum: int, ~tip: int, ~mode: string) => gridExpansionController

/** Owns lazy mining-attribution requests and results */
let useBlockAttribution: unit => blockAttributionController

/** Owns all interactive state for one standalone monitor grid */
let useGrid: (~periodNum: int, ~tip: int, ~mode: string) => gridController

/** Owns all interactive state for the full monitor dashboard */
let useDashboard: (~periodNum: int, ~tip: int) => dashboardController
