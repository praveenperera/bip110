/** Supported number of recent blocks to summarize */
@genType
type window =
  | @as(48) Blocks48
  | @as(72) Blocks72
  | @as(144) Blocks144

/** Block fields used to calculate recent signaling */
@genType
type signalingBlock = {
  height: int,
  signaling: bool,
}

/** Signaling summary for a recent block window */
@genType
type recent = {
  window: window,
  sampled: int,
  signaling: int,
  pct: float,
  partial: bool,
}

/** Supported recent-block window sizes */
@genType
let recentWindows: array<window>

/** Recent-block window used when the URL does not select one */
@genType
let defaultRecentWindow: window

/** Query parameter that selects the recent-block window */
@genType
let recentWindowParam: string

/** Calculates signaling over the newest supported window */
@genType
let recentSignaling: (array<signalingBlock>, window) => recent

/** Reads a window query value and falls back to the default */
@genType
let parseRecentWindow: Nullable.t<string> => window

/** Updates a search string with the selected recent window */
@genType
let recentWindowSearch: (string, window) => string

/** Formats the heading for a recent-block window */
@genType
let recentWindowHeading: window => string

/** Describes the target elapsed time for a recent-block window */
@genType
let recentWindowDuration: window => string

/** Formats the signaling count for a recent-block summary */
@genType
let recentSignalingCounts: recent => string

/** Formats supporting detail for a recent-block summary */
@genType
let recentSignalingDetail: (recent, int) => string
