type abortSignal
type abortController
type response
type storage
type browserEvent
type customEvent
type location
type history
type domElement

type scrollIntoViewOptions = {
  behavior: string,
  block: string,
}

type requestInit = {
  cache: string,
  signal: Nullable.t<abortSignal>,
}

@genType
type cachedMonitorData = {
  cachedAt: float,
  data: Monitor.monitorData,
}

type cachedMonitorDataWire = {
  cachedAt: float,
  data: Monitor.monitorData,
  version: int,
}

type customEventInit = {detail: cachedMonitorDataWire}

@val external fetch: (string, requestInit) => promise<response> = "fetch"
@get external responseOk: response => bool = "ok"
@get external responseStatus: response => int = "status"
@send external responseJson: response => promise<JSON.t> = "json"

@new external makeAbortControllerExternal: unit => abortController = "AbortController"
@get external abortSignal: abortController => abortSignal = "signal"
@send external abort: abortController => unit = "abort"

@val external localStorage: storage = "localStorage"
@send external getStorageItem: (storage, string) => Nullable.t<string> = "getItem"
@send external setStorageItem: (storage, string, string) => unit = "setItem"

@new
external makeCustomEvent: (string, customEventInit) => customEvent = "CustomEvent"

@scope("window") @val
external dispatchWindowEvent: customEvent => bool = "dispatchEvent"

@scope("window") @val
external addWindowEventListener: (string, browserEvent => unit) => unit = "addEventListener"

@scope("window") @val
external removeWindowEventListener: (string, browserEvent => unit) => unit = "removeEventListener"

@scope("document") @val
external addDocumentEventListener: (string, browserEvent => unit) => unit = "addEventListener"

@scope("document") @val
external removeDocumentEventListener: (string, browserEvent => unit) => unit = "removeEventListener"

@scope("document") @val
external visibilityState: string = "visibilityState"

@get external eventDetail: browserEvent => Nullable.t<JSON.t> = "detail"

@scope("window") @val
external setIntervalExternal: (unit => unit, int) => int = "setInterval"

@scope("window") @val external clearIntervalExternal: int => unit = "clearInterval"

@scope("window") @val external location: location = "location"
@get external locationHostname: location => string = "hostname"
@get external locationHash: location => string = "hash"
@get external locationSearch: location => string = "search"
@get external locationPathname: location => string = "pathname"

@scope("window") @val external history: history = "history"
@get external historyState: history => Nullable.t<JSON.t> = "state"

@send
external replaceHistoryState: (history, Nullable.t<JSON.t>, string, string) => unit = "replaceState"

@scope("document") @val
external querySelector: string => Nullable.t<domElement> = "querySelector"

@send
external scrollIntoViewWithOptions: (domElement, scrollIntoViewOptions) => unit = "scrollIntoView"

@val external dateNow: unit => float = "Date.now"

let apiUrl = "/api/monitor"
let blocksApiUrl = "/api/monitor-blocks"
let localDevApiUrl = "https://bip110monitor.com/api"
let blockMiningAttributionApiUrls = [
  "https://mempool.space/api/v1/block",
  "https://mempool.guide/api/v1/block",
]
let cacheKey = "bip110-monitor-data"
let monitorDataEvent = "bip110-monitor-data"
let cacheVersion = 2

let requestInit = signal => {cache: "no-store", signal}

let responseError = (label, response) =>
  JsError.throwWithMessage(`${label} returned ${response->responseStatus->Int.toString}`)

@genType
let decodeCachedMonitorData = value => {
  try {
    switch value {
    | JSON.Object(object) =>
      switch (object->Dict.get("version"), object->Dict.get("cachedAt"), object->Dict.get("data")) {
      | (Some(JSON.Number(version)), Some(JSON.Number(cachedAt)), Some(data))
        if version === cacheVersion->Int.toFloat && cachedAt->Float.isFinite && cachedAt >= 0.0 =>
        Nullable.make({
          cachedAt,
          data: Monitor.parseMonitorData(data),
        })
      | _ => Nullable.null
      }
    | _ => Nullable.null
    }
  } catch {
  | _ => Nullable.null
  }
}

let readCachedMonitorData = () => {
  try {
    switch localStorage->getStorageItem(cacheKey)->Nullable.toOption {
    | Some(value) => value->JSON.parseOrThrow->decodeCachedMonitorData
    | None => Nullable.null
    }
  } catch {
  | _ => Nullable.null
  }
}

let writeCachedMonitorData = (data, cachedAt) => {
  let wire: cachedMonitorDataWire = {
    cachedAt,
    data,
    version: cacheVersion,
  }

  try {
    switch JSON.stringifyAny(wire) {
    | Some(value) => localStorage->setStorageItem(cacheKey, value)
    | None => ()
    }
  } catch {
  | _ => ()
  }

  makeCustomEvent(monitorDataEvent, {detail: wire})
  ->dispatchWindowEvent
  ->ignore
}

let makeAbortController = makeAbortControllerExternal
let abortControllerSignal = abortSignal
let abortRequest = abort
let now = dateNow

let isAbortError = error =>
  error
  ->JsExn.fromException
  ->Option.flatMap(JsExn.name)
  ->Option.getOr("") === "AbortError"

let errorMessage = (error, fallback) =>
  error
  ->JsExn.fromException
  ->Option.flatMap(JsExn.message)
  ->Option.getOr(fallback)

let isLocalDevHost = () =>
  switch location->locationHostname {
  | "127.0.0.1" | "localhost" | "::1" => true
  | _ => false
  }

let fetchMonitorData = async signal => {
  let response = await fetch(apiUrl, requestInit(signal))

  if response->responseOk {
    let json = await response->responseJson
    Monitor.parseMonitorData(json)
  } else if response->responseStatus === 404 && isLocalDevHost() {
    let fallbackResponse = await fetch(localDevApiUrl, requestInit(signal))

    if fallbackResponse->responseOk {
      let json = await fallbackResponse->responseJson
      Monitor.parseMonitorData(json)
    } else {
      responseError("Monitor API", fallbackResponse)
    }
  } else {
    responseError("Monitor API", response)
  }
}

let fetchMonitorBlocks = async (expectedTip, signal) => {
  let url = switch expectedTip->Nullable.toOption {
  | Some(expectedTip) => `${blocksApiUrl}?tip=${expectedTip->Int.toString}`
  | None => blocksApiUrl
  }
  let response = await fetch(url, requestInit(signal))

  if response->responseOk {
    let json = await response->responseJson
    Monitor.parseMonitorBlocksPayload(json)
  } else {
    responseError("Monitor block API", response)
  }
}

let fetchBlockMiningAttribution = async hash => {
  let rec fetchFrom = async index => {
    switch blockMiningAttributionApiUrls[index] {
    | None => JsError.throwWithMessage("Block mining attribution providers unavailable")
    | Some(apiUrl) =>
      try {
        let response = await fetch(`${apiUrl}/${hash}`, requestInit(Nullable.null))

        if response->responseOk {
          let json = await response->responseJson
          Monitor.parseBlockMiningAttribution(json)
        } else {
          responseError("Block explorer API", response)
        }
      } catch {
      | _ => await fetchFrom(index + 1)
      }
    }
  }

  await fetchFrom(0)
}

let isPageVisible = () => visibilityState === "visible"

let watchFocusAndVisibility = callback => {
  let windowListener = _ => callback()
  let documentListener = _ => callback()
  addWindowEventListener("focus", windowListener)
  addDocumentEventListener("visibilitychange", documentListener)

  () => {
    removeWindowEventListener("focus", windowListener)
    removeDocumentEventListener("visibilitychange", documentListener)
  }
}

let watchMonitorData = callback => {
  let listener = event => {
    switch event
    ->eventDetail
    ->Nullable.toOption
    ->Option.flatMap(detail => detail->decodeCachedMonitorData->Nullable.toOption) {
    | Some(cached) => callback(cached)
    | None => ()
    }
  }
  addWindowEventListener(monitorDataEvent, listener)

  () => removeWindowEventListener(monitorDataEvent, listener)
}

let setInterval = (callback, milliseconds) => {
  let timer = setIntervalExternal(callback, milliseconds)
  () => clearIntervalExternal(timer)
}

let locationHash = () => location->locationHash
let locationSearch = () => location->locationSearch

let recentWindowQueryValue = () =>
  locationSearch()
  ->Browser.makeUrlSearchParams
  ->Browser.getSearchParam(RecentSignaling.recentWindowParam)

let replaceRecentWindowLocation = search => {
  history->replaceHistoryState(
    history->historyState,
    "",
    `${location->locationPathname}${search}#recent-signaling`,
  )
}

let scrollToMonitorSection = sectionId => {
  switch querySelector(`[data-monitor-react] #${sectionId}`)->Nullable.toOption {
  | Some(element) => element->scrollIntoViewWithOptions({behavior: "instant", block: "start"})
  | None => ()
  }
}

let watchHashChange = callback => {
  let listener = _ => callback()
  addWindowEventListener("hashchange", listener)

  () => removeWindowEventListener("hashchange", listener)
}

let watchPopState = callback => {
  let listener = _ => callback()
  addWindowEventListener("popstate", listener)

  () => removeWindowEventListener("popstate", listener)
}
