@react.component
let make = (~mode="bip110") => {
  let monitor = MonitorDataController.useMonitorData(
    ~refreshIntervalMs=None,
    ~refreshOnFocus=mode !== "ursf",
    ~listenForCacheEvents=true,
  )
  let data = monitor.state->MonitorDataController.data
  let expectedTip = switch data->Nullable.toOption {
  | Some(data) => Nullable.make(data.tip)
  | None => Nullable.null
  }
  let monitorBlocks = MonitorBlocksController.useMonitorBlocks(expectedTip)
  let (periodNum, tip) = switch data->Nullable.toOption {
  | Some(data) => (data.periodNum, data.tip)
  | None => (-1, -1)
  }
  let grid = MonitorDashboardUiController.useGrid(~periodNum, ~tip, ~mode)

  React.useEffect1(() => {
    if !Nullable.isNullable(data) && MonitorDashboardClient.locationHash() === "#block-grid" {
      MonitorDashboardClient.scrollToMonitorSection("block-grid")
    }

    None
  }, [data])

  <MonitorBlockGridPresentation
    attributionForHash={grid.attributionState}
    blockDataStatus={monitorBlocks.state->MonitorBlocksController.status}
    blocks={monitorBlocks.state->MonitorBlocksController.blocks}
    data
    error={monitor.state->MonitorDataController.error}
    loading={monitor.state->MonitorDataController.loading}
    mode
    onAttributionOpen={grid.loadAttribution}
    onShowAllBlocks={grid.expandBlocks}
    showAllBlocks={grid.showAllBlocks}
  />
}
