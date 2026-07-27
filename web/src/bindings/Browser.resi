type urlSearchParams

/** Creates URL search parameters from a query string */
let makeUrlSearchParams: string => urlSearchParams

/** Reads one nullable URL search parameter */
let getSearchParam: (urlSearchParams, string) => Nullable.t<string>

/** Removes one URL search parameter */
let deleteSearchParam: (urlSearchParams, string) => unit

/** Sets one URL search parameter */
let setSearchParam: (urlSearchParams, string, string) => unit

/** Serializes URL search parameters */
let searchParamsToString: urlSearchParams => string

/** Reads a nullable local-storage value */
let getLocalStorageItem: string => Nullable.t<string>

/** Writes one local-storage value */
let setLocalStorageItem: (string, string) => unit

/** Returns whether the system currently prefers a dark color scheme */
let prefersDarkColorScheme: unit => bool

/** Subscribes to system dark-color-scheme changes and returns an unsubscribe function */
let watchDarkColorScheme: (bool => unit) => unit => unit

/** Applies the document's dark-mode class */
let setDocumentDarkClass: bool => unit

/** Returns the current location hash */
let getLocationHash: unit => string

/** Decodes a location hash, preserving malformed URI sequences */
let decodeLocationHash: string => string

/** Replaces the current history entry with the supplied hash */
let replaceLocationHash: string => unit

/** Subscribes to location-hash changes and returns an unsubscribe function */
let watchHashChange: (unit => unit) => unit => unit
