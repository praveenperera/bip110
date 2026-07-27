/** Renders the monitor dashboard around narrow package-specific view adapters */
@react.component
let make: (
  ~attributionForHash: string => MonitorDashboardUiController.attributionState,
  ~blockDataStatus: MonitorBlocksController.dataStatus,
  ~blocks: Nullable.t<array<Monitor.monitorBlockWire>>,
  ~cacheInfo: Nullable.t<MonitorDataController.cacheInfo>,
  ~chartMetric: MonitorDashboardModel.periodChartMetric,
  ~data: Nullable.t<Monitor.monitorData>,
  ~error: Nullable.t<string>,
  ~loading: bool,
  ~now: float,
  ~onAttributionOpen: string => unit,
  ~onChartMetricChange: MonitorDashboardModel.periodChartMetric => unit,
  ~onRefresh: unit => unit,
  ~onRecentWindowChange: RecentSignaling.window => unit,
  ~onShowAllBlocks: unit => unit,
  ~recentWindow: RecentSignaling.window,
  ~refreshing: bool,
  ~showAllBlocks: bool,
) => React.element
