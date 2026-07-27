/** Renders the URL-selectable recent signaling summary */
@react.component
let make: (
  ~blockDataStatus: MonitorBlocksController.dataStatus,
  ~blocks: Nullable.t<array<Monitor.monitorBlockWire>>,
  ~cacheInfo: Nullable.t<MonitorDataController.cacheInfo>,
  ~data: Monitor.monitorData,
  ~onWindowChange: RecentSignaling.window => unit,
  ~windowSize: RecentSignaling.window,
) => React.element
