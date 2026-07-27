type domElement
type timeout

/** Returns the current browser pathname */
let currentPathname: unit => string

/** Starts a one-shot browser timer */
let setTimeout: (unit => unit, int) => timeout

/** Cancels a one-shot browser timer */
let clearTimeout: timeout => unit

/** Watches escape and outside clicks until the returned cleanup runs */
let watchMobileDismiss: (unit => option<domElement>, unit => unit) => unit => unit
