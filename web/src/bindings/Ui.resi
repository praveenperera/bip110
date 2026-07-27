/** Card view primitive */
module Card: {
  /** Renders a card container */
  @react.component
  let make: (~className: string=?, ~id: string=?, ~children: React.element) => React.element
}

/** Card-content view primitive */
module CardContent: {
  /** Renders card content */
  @react.component
  let make: (~className: string=?, ~children: React.element) => React.element
}

/** Card-header view primitive */
module CardHeader: {
  /** Renders a card header */
  @react.component
  let make: (~className: string=?, ~children: React.element) => React.element
}

/** Card-title view primitive */
module CardTitle: {
  /** Renders a card title */
  @react.component
  let make: (~className: string=?, ~children: React.element) => React.element
}

/** Accordion root primitive */
module Accordion: {
  /** Renders an accordion root */
  @react.component
  let make: (
    ~className: string=?,
    ~onValueChange: array<string> => unit=?,
    ~value: array<string>=?,
    ~children: React.element,
  ) => React.element
}

/** Accordion-item primitive */
module AccordionItem: {
  /** Renders an accordion item */
  @react.component
  let make: (
    ~className: string=?,
    ~id: string=?,
    ~value: string,
    ~children: React.element,
  ) => React.element
}

/** Accordion-trigger primitive */
module AccordionTrigger: {
  /** Renders an accordion trigger */
  @react.component
  let make: (
    ~className: string=?,
    ~onClick: unit => unit=?,
    ~children: React.element,
  ) => React.element
}

/** Accordion-content primitive */
module AccordionContent: {
  /** Renders accordion content */
  @react.component
  let make: (~className: string=?, ~children: React.element) => React.element
}

/** Badge view primitive */
module Badge: {
  /** Renders a badge */
  @react.component
  let make: (~className: string=?, ~variant: string=?, ~children: React.element) => React.element
}

/** Button view primitive */
module Button: {
  /** Renders a button */
  @react.component
  let make: (
    ~className: string=?,
    ~disabled: bool=?,
    ~onClick: unit => unit,
    ~size: string=?,
    ~variant: string=?,
    ~children: React.element,
  ) => React.element
}

/** External-link icon */
module ExternalLink: {
  /** Renders the icon */
  @react.component
  let make: (~className: string=?) => React.element
}

/** Alert-circle icon */
module AlertCircle: {
  /** Renders the icon */
  @react.component
  let make: (~className: string=?) => React.element
}

/** Refresh icon */
module RefreshCw: {
  /** Renders the icon */
  @react.component
  let make: (~className: string=?) => React.element
}

/** Sparkles icon */
module Sparkles: {
  /** Renders the icon */
  @react.component
  let make: (~className: string=?) => React.element
}

/** Down-chevron icon */
module ChevronDown: {
  /** Renders the icon */
  @react.component
  let make: (~className: string=?) => React.element
}

/** Menu icon */
module Menu: {
  /** Renders the icon */
  @react.component
  let make: (~className: string=?) => React.element
}

/** Close icon */
module X: {
  /** Renders the icon */
  @react.component
  let make: (~className: string=?) => React.element
}

/** Moon icon */
module Moon: {
  /** Renders the icon */
  @react.component
  let make: (~className: string=?) => React.element
}

/** Sun icon */
module Sun: {
  /** Renders the icon */
  @react.component
  let make: (~className: string=?) => React.element
}

/** Variant options for an anchor styled as a button */
type buttonVariantOptions = {
  variant: string,
  size: string,
}

/** Returns the class list for one button variant */
let buttonVariants: buttonVariantOptions => string
