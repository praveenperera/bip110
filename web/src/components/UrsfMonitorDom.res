type element
type style

@scope("document") @val
external querySelectorAll: string => array<element> = "querySelectorAll"

@scope("document") @val
external querySelector: string => Nullable.t<element> = "querySelector"

@set external setTextContent: (element, string) => unit = "textContent"
@set external setInnerHtml: (element, string) => unit = "innerHTML"
@get external elementStyle: element => style = "style"
@set external setStyleWidth: (style, string) => unit = "width"

@scope("Object") @val external dictKeys: Dict.t<'value> => array<string> = "keys"

let setText = (field, value) =>
  querySelectorAll(`[data-ursf-field="${field}"]`)->Array.forEach(element =>
    element->setTextContent(value)
  )

let setHtml = (selector, html) => {
  switch querySelector(selector)->Nullable.toOption {
  | Some(element) => element->setInnerHtml(html)
  | None => ()
  }
}

let setWidth = (selector, width) => {
  switch querySelector(selector)->Nullable.toOption {
  | Some(element) => element->elementStyle->setStyleWidth(width)
  | None => ()
  }
}

let render = data => {
  let fields = UrsfPageModel.monitorFields(data)
  fields
  ->dictKeys
  ->Array.forEach(field => {
    switch fields->Dict.get(field) {
    | Some(value) => setText(field, value)
    | None => ()
    }
  })

  setWidth(
    `[data-ursf-progress="period"]`,
    `${UrsfPageModel.periodProgressPercent(data)->Float.toString}%`,
  )
  setHtml("[data-ursf-history-body]", UrsfPageModel.historyTableRowsHtml(data))
  setHtml("[data-ursf-period-chart]", UrsfPageModel.periodChartHtml(data))
}
