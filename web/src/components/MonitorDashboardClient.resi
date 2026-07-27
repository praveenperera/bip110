type abortSignal
type abortController

/** Validated monitor snapshot restored from browser storage */
@genType
type cachedMonitorData = {
  cachedAt: float,
  data: Monitor.monitorData,
}

/** Decodes and validates one persisted monitor-cache entry */
@genType
let decodeCachedMonitorData: JSON.t => Nullable.t<cachedMonitorData>

/** Reads and validates the current browser monitor cache */
let readCachedMonitorData: unit => Nullable.t<cachedMonitorData>

/** Persists monitor data and broadcasts it to other islands */
let writeCachedMonitorData: (Monitor.monitorData, float) => unit

/** Creates a browser request-cancellation controller */
let makeAbortController: unit => abortController

/** Returns the signal owned by a cancellation controller */
let abortControllerSignal: abortController => abortSignal

/** Cancels the request owned by a controller */
let abortRequest: abortController => unit

/** Returns the current epoch time in milliseconds */
let now: unit => float

/** Checks whether a caught exception represents request cancellation */
let isAbortError: exn => bool

/** Extracts a JavaScript error message with a stable fallback */
let errorMessage: (exn, string) => string

/** Loads and validates the current monitor snapshot */
let fetchMonitorData: Nullable.t<abortSignal> => promise<Monitor.monitorData>

/** Loads and validates current monitor blocks */
let fetchMonitorBlocks: (
  Nullable.t<int>,
  Nullable.t<abortSignal>,
) => promise<Monitor.monitorBlocksPayload>

/** Loads and validates block-mining attribution through explorer fallbacks */
let fetchBlockMiningAttribution: string => promise<Nullable.t<Monitor.blockMiningAttribution>>

/** Returns whether the document is currently visible */
let isPageVisible: unit => bool

/** Subscribes to focus and visibility changes */
let watchFocusAndVisibility: (unit => unit) => unit => unit

/** Subscribes to validated in-page monitor-cache updates */
let watchMonitorData: (cachedMonitorData => unit) => unit => unit

/** Starts a browser interval and returns its cleanup function */
let setInterval: (unit => unit, int) => unit => unit

/** Returns the current location hash */
let locationHash: unit => string

/** Returns the current location search string */
let locationSearch: unit => string

/** Reads the recent-window query parameter from the current location */
let recentWindowQueryValue: unit => Nullable.t<string>

/** Replaces the URL search and anchors it to recent signaling */
let replaceRecentWindowLocation: string => unit

/** Scrolls one monitor-owned section into view */
let scrollToMonitorSection: string => unit

/** Subscribes to location-hash changes */
let watchHashChange: (unit => unit) => unit => unit

/** Subscribes to browser history navigation */
let watchPopState: (unit => unit) => unit => unit
