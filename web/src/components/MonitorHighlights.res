@react.component
let make = () => {
  let controller = MonitorDataController.useMonitorData(
    ~refreshIntervalMs=None,
    ~refreshOnFocus=true,
    ~listenForCacheEvents=false,
  )

  <MonitorHighlightsPresentation
    cacheInfo={controller.state->MonitorDataController.cacheInfo}
    data={controller.state->MonitorDataController.data}
    error={controller.state->MonitorDataController.error}
    loading={controller.state->MonitorDataController.loading}
  />
}
