/** Text-only social metadata derived from one monitor snapshot */
@genType
type metadataText = {
  title: string,
  description: string,
  imageAlt: string,
}

/** Human-readable monitor synchronization state, or an empty string when current */
@genType
let monitorSyncStatus: Monitor.monitorData => string

/** BIP-110 activation progress clamped to a percentage */
@genType
let activationProgressPercent: Monitor.monitorData => float

/** Current difficulty-period progress clamped to a percentage */
@genType
let periodProgressPercent: Monitor.monitorData => float

/** Accessible SVG chart of signaling percentage by difficulty period */
@genType
let periodSignalingChartHtml: Monitor.monitorData => string

/** Dynamic text fields for the server-rendered monitor page */
@genType
let monitorPageFields: (
  Monitor.monitorData,
  array<Monitor.monitorBlockWire>,
  RecentSignaling.window,
  float,
) => Dict.t<string>

/** Social metadata text for the server-rendered monitor page */
@genType
let monitorMetadataText: Monitor.monitorData => metadataText
