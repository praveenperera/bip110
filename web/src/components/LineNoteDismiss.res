type browserEvent
type node
type detailsElement

@scope("document") @val
external addDocumentEventListener: (string, browserEvent => unit) => unit = "addEventListener"

@scope("document") @val
external removeDocumentEventListener: (string, browserEvent => unit) => unit = "removeEventListener"

@scope("document") @val
external querySelectorAll: string => array<detailsElement> = "querySelectorAll"

@get external eventTarget: browserEvent => Nullable.t<node> = "target"
@send external contains: (detailsElement, node) => bool = "contains"
@get external isOpen: detailsElement => bool = "open"
@set external setOpen: (detailsElement, bool) => unit = "open"

let start = () => {
  let listener = event => {
    switch event->eventTarget->Nullable.toOption {
    | Some(target) =>
      querySelectorAll(".line-note[open]")->Array.forEach(note => {
        if note->isOpen && !contains(note, target) {
          note->setOpen(false)
        }
      })
    | None => ()
    }
  }

  addDocumentEventListener("click", listener)
  () => removeDocumentEventListener("click", listener)
}
