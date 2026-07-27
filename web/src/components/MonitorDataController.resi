/** Provenance of the currently displayed monitor snapshot */
type cacheSource = [#cache | #network]

/** Cache metadata attached to a loaded monitor snapshot */
type cacheInfo = {
  cachedAt: float,
  source: cacheSource,
}

/** Valid monitor-data lifecycle with cache provenance and request status */
type state

/** Monitor-data controller returned by the shared React hook */
type controller = {
  state: state,
  refresh: unit => unit,
}

/** Restores, refreshes, and optionally polls shared monitor data */
let useMonitorData: (
  ~refreshIntervalMs: option<int>,
  ~refreshOnFocus: bool,
  ~listenForCacheEvents: bool,
) => controller

/** Returns loaded monitor data or null while unavailable */
let data: state => Nullable.t<Monitor.monitorData>

/** Returns cache provenance for loaded monitor data */
let cacheInfo: state => Nullable.t<cacheInfo>

/** Returns the last non-cancellation request error */
let error: state => Nullable.t<string>

/** Returns whether the initial request has no data to display */
let loading: state => bool

/** Returns whether a user-visible refresh is active */
let refreshing: state => bool
