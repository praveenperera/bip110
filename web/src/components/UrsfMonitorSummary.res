@react.component
let make = () => {
  let monitor = MonitorDataController.useMonitorData(
    ~refreshIntervalMs=None,
    ~refreshOnFocus=true,
    ~listenForCacheEvents=true,
  )
  let data = monitor.state->MonitorDataController.data

  React.useEffect1(() => {
    switch data->Nullable.toOption {
    | Some(data) => UrsfMonitorDom.render(data)
    | None => ()
    }

    None
  }, [data])

  React.null
}
