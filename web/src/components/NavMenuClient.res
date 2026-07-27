type domElement
type domNode
type browserEvent
type timeout
type location

@scope("window") @val external location: location = "location"
@get external locationPathname: location => string = "pathname"

@scope("document") @val
external addDocumentEventListener: (string, browserEvent => unit) => unit = "addEventListener"

@scope("document") @val
external removeDocumentEventListener: (string, browserEvent => unit) => unit = "removeEventListener"

@get external eventKey: browserEvent => Nullable.t<string> = "key"
@get external eventTarget: browserEvent => Nullable.t<domNode> = "target"
@send external elementContains: (domElement, domNode) => bool = "contains"

@scope("window") @val
external setTimeoutExternal: (unit => unit, int) => timeout = "setTimeout"

@scope("window") @val external clearTimeoutExternal: timeout => unit = "clearTimeout"

let currentPathname = () => location->locationPathname
let setTimeout = (callback, milliseconds) => setTimeoutExternal(callback, milliseconds)
let clearTimeout = timeout => timeout->clearTimeoutExternal

let watchMobileDismiss = (element, dismiss) => {
  let keyListener = event => {
    switch event->eventKey->Nullable.toOption {
    | Some("Escape") => dismiss()
    | Some(_)
    | None => ()
    }
  }
  let mouseListener = event => {
    switch (element(), event->eventTarget->Nullable.toOption) {
    | (Some(element), Some(target)) if !elementContains(element, target) => dismiss()
    | _ => ()
    }
  }

  addDocumentEventListener("keydown", keyListener)
  addDocumentEventListener("mousedown", mouseListener)

  () => {
    removeDocumentEventListener("keydown", keyListener)
    removeDocumentEventListener("mousedown", mouseListener)
  }
}
