let refreshIntervalMs = 15_000

@react.component
let make = () => {
  let monitor = MonitorDataController.useMonitorData(
    ~refreshIntervalMs=Some(refreshIntervalMs),
    ~refreshOnFocus=true,
    ~listenForCacheEvents=false,
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
  let ui = MonitorDashboardUiController.useDashboard(~periodNum, ~tip)

  let refresh = React.useCallback2(() => {
    monitor.refresh()
    monitorBlocks.refresh()
  }, (monitor.refresh, monitorBlocks.refresh))

  React.useEffect1(() => {
    let scrollToSection = () => {
      let hash = MonitorDashboardClient.locationHash()
      let sectionId =
        hash->String.startsWith("#") ? hash->String.slice(~start=1, ~end=hash->String.length) : hash

      if MonitorDashboardModel.isMonitorSectionId(sectionId) {
        MonitorDashboardClient.scrollToMonitorSection(sectionId)
      }
    }

    scrollToSection()
    Some(MonitorDashboardClient.watchHashChange(scrollToSection))
  }, [data])

  <MonitorDashboardPresentation
    attributionForHash={ui.grid.attributionState}
    blockDataStatus={monitorBlocks.state->MonitorBlocksController.status}
    blocks={monitorBlocks.state->MonitorBlocksController.blocks}
    cacheInfo={monitor.state->MonitorDataController.cacheInfo}
    chartMetric={ui.chartMetric}
    data
    error={monitor.state->MonitorDataController.error}
    loading={monitor.state->MonitorDataController.loading}
    now={ui.now}
    onAttributionOpen={ui.grid.loadAttribution}
    onChartMetricChange={ui.selectChartMetric}
    onRefresh={refresh}
    onRecentWindowChange={ui.selectRecentWindow}
    onShowAllBlocks={ui.grid.expandBlocks}
    recentWindow={ui.recentWindow}
    refreshing={monitor.state->MonitorDataController.refreshing}
    showAllBlocks={ui.grid.showAllBlocks}
  />
}
