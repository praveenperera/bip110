/** Query values accepted by the dynamic monitor social image */
@genType
type imageParams = {
  period: Nullable.t<string>,
  tip: Nullable.t<string>,
  blocks: Nullable.t<string>,
  signals: Nullable.t<string>,
  pct: Nullable.t<string>,
  updated: Nullable.t<string>,
}

/** Dynamic text and geometry for one monitor social image */
@genType
type renderPlan = {
  signalWidth: int,
  thresholdX: int,
  periodProgressWidth: int,
  periodProgressLabel: string,
  pctLabel: string,
  periodLabel: string,
  blocksLabel: string,
  tipLabel: string,
  thresholdLabel: string,
  thresholdPercentLabel: string,
}

/** Returns whether any dynamic image parameter was supplied */
@genType
let hasImageParams: imageParams => bool

/** Validates dynamic image parameters and constructs a monitor snapshot */
@genType
let parseImageData: imageParams => Nullable.t<Monitor.monitorData>

/** Derives all dynamic labels and bar geometry for the raster adapter */
@genType
let renderPlan: Monitor.monitorData => renderPlan
