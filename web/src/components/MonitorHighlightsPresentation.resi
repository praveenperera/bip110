/** Renders the landing-page monitor summary */
@react.component
let make: (
  ~cacheInfo: Nullable.t<MonitorDataController.cacheInfo>,
  ~data: Nullable.t<Monitor.monitorData>,
  ~error: Nullable.t<string>,
  ~loading: bool,
) => React.element
