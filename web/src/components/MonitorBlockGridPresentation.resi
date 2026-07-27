/** Renders the block grid around one narrow Base UI tooltip adapter */
@react.component
let make: (
  ~attributionForHash: string => MonitorDashboardUiController.attributionState,
  ~blockDataStatus: MonitorBlocksController.dataStatus,
  ~blocks: Nullable.t<array<Monitor.monitorBlockWire>>,
  ~data: Nullable.t<Monitor.monitorData>,
  ~error: Nullable.t<string>,
  ~loading: bool,
  ~mode: string=?,
  ~onAttributionOpen: string => unit,
  ~onShowAllBlocks: unit => unit,
  ~showAllBlocks: bool,
) => React.element
