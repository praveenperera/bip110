type urlSearchParams
type storage
type mediaQueryList
type mediaQueryEvent
type windowEvent
type domElement
type classList
type location
type history

@val external localStorage: storage = "localStorage"
@send external getStorageItem: (storage, string) => Nullable.t<string> = "getItem"
@send external setStorageItem: (storage, string, string) => unit = "setItem"

@scope("window") @val
external matchMedia: string => mediaQueryList = "matchMedia"

@get external mediaQueryMatches: mediaQueryList => bool = "matches"
@get external mediaQueryEventMatches: mediaQueryEvent => bool = "matches"

@send
external addMediaQueryListener: (mediaQueryList, @as("change") _, mediaQueryEvent => unit) => unit =
  "addEventListener"

@send
external removeMediaQueryListener: (
  mediaQueryList,
  @as("change") _,
  mediaQueryEvent => unit,
) => unit = "removeEventListener"

@scope("document") @val
external documentElement: domElement = "documentElement"

@get external classList: domElement => classList = "classList"
@send external toggleClass: (classList, string, bool) => bool = "toggle"

@new
external makeUrlSearchParams: string => urlSearchParams = "URLSearchParams"

@send
external getSearchParam: (urlSearchParams, string) => Nullable.t<string> = "get"

@send
external deleteSearchParam: (urlSearchParams, string) => unit = "delete"

@send
external setSearchParam: (urlSearchParams, string, string) => unit = "set"

@send
external searchParamsToString: urlSearchParams => string = "toString"

@scope("window") @val external location: location = "location"
@get external locationHash: location => string = "hash"

@scope("window") @val external history: history = "history"
@send external replaceHistoryState: (history, JSON.t, string, string) => unit = "replaceState"

@scope("window") @val
external addHashChangeListener: (@as("hashchange") _, windowEvent => unit) => unit =
  "addEventListener"

@scope("window") @val
external removeHashChangeListener: (@as("hashchange") _, windowEvent => unit) => unit =
  "removeEventListener"

@val external decodeUriComponent: string => string = "decodeURIComponent"

let getLocalStorageItem = key => localStorage->getStorageItem(key)

let setLocalStorageItem = (key, value) => localStorage->setStorageItem(key, value)

let prefersDarkColorScheme = () => matchMedia("(prefers-color-scheme: dark)")->mediaQueryMatches

let watchDarkColorScheme = callback => {
  let query = matchMedia("(prefers-color-scheme: dark)")
  let listener = event => callback(mediaQueryEventMatches(event))
  query->addMediaQueryListener(listener)

  () => query->removeMediaQueryListener(listener)
}

let setDocumentDarkClass = dark => {
  documentElement->classList->toggleClass("dark", dark)->ignore
}

let getLocationHash = () => location->locationHash

let decodeLocationHash = hash => {
  let encoded =
    hash->String.startsWith("#") ? hash->String.slice(~start=1, ~end=hash->String.length) : hash

  try {
    decodeUriComponent(encoded)
  } catch {
  | _ => encoded
  }
}

let replaceLocationHash = hash =>
  history->replaceHistoryState(JSON.Object(Dict.make()), "", `#${hash}`)

let watchHashChange = callback => {
  let listener = _ => callback()
  addHashChangeListener(listener)

  () => removeHashChangeListener(listener)
}
