/** Dynamic text fields for the server-rendered URSF monitor */
@genType
let monitorFields: Monitor.monitorData => Dict.t<string>

/** Current difficulty-period progress clamped to a percentage */
@genType
let periodProgressPercent: Monitor.monitorData => float

/** Server-rendered URSF period history rows */
@genType
let historyTableRowsHtml: Monitor.monitorData => string

/** Accessible zero-signaling SVG chart for the URSF monitor */
@genType
let periodChartHtml: Monitor.monitorData => string
