module Card = {
  @module("../components/ui/card") @react.component
  external make: (~className: string=?, ~id: string=?, ~children: React.element) => React.element =
    "Card"
}

module CardContent = {
  @module("../components/ui/card") @react.component
  external make: (~className: string=?, ~children: React.element) => React.element = "CardContent"
}

module CardHeader = {
  @module("../components/ui/card") @react.component
  external make: (~className: string=?, ~children: React.element) => React.element = "CardHeader"
}

module CardTitle = {
  @module("../components/ui/card") @react.component
  external make: (~className: string=?, ~children: React.element) => React.element = "CardTitle"
}

module Accordion = {
  @module("../components/ui/accordion") @react.component
  external make: (
    ~className: string=?,
    ~onValueChange: array<string> => unit=?,
    ~value: array<string>=?,
    ~children: React.element,
  ) => React.element = "Accordion"
}

module AccordionItem = {
  @module("../components/ui/accordion") @react.component
  external make: (
    ~className: string=?,
    ~id: string=?,
    ~value: string,
    ~children: React.element,
  ) => React.element = "AccordionItem"
}

module AccordionTrigger = {
  @module("../components/ui/accordion") @react.component
  external make: (
    ~className: string=?,
    ~onClick: unit => unit=?,
    ~children: React.element,
  ) => React.element = "AccordionTrigger"
}

module AccordionContent = {
  @module("../components/ui/accordion") @react.component
  external make: (~className: string=?, ~children: React.element) => React.element =
    "AccordionContent"
}

module Badge = {
  @module("../components/ui/badge") @react.component
  external make: (
    ~className: string=?,
    ~variant: string=?,
    ~children: React.element,
  ) => React.element = "Badge"
}

module Button = {
  @module("../components/ui/button") @react.component
  external make: (
    ~className: string=?,
    ~disabled: bool=?,
    ~onClick: unit => unit,
    ~size: string=?,
    ~variant: string=?,
    ~children: React.element,
  ) => React.element = "Button"
}

module ExternalLink = {
  @module("lucide-react") @react.component
  external make: (~className: string=?) => React.element = "ExternalLink"
}

module AlertCircle = {
  @module("lucide-react") @react.component
  external make: (~className: string=?) => React.element = "AlertCircle"
}

module RefreshCw = {
  @module("lucide-react") @react.component
  external make: (~className: string=?) => React.element = "RefreshCw"
}

module Sparkles = {
  @module("lucide-react") @react.component
  external make: (~className: string=?) => React.element = "Sparkles"
}

module ChevronDown = {
  @module("lucide-react") @react.component
  external make: (~className: string=?) => React.element = "ChevronDown"
}

module Menu = {
  @module("lucide-react") @react.component
  external make: (~className: string=?) => React.element = "Menu"
}

module X = {
  @module("lucide-react") @react.component
  external make: (~className: string=?) => React.element = "X"
}

module Moon = {
  @module("lucide-react") @react.component
  external make: (~className: string=?) => React.element = "Moon"
}

module Sun = {
  @module("lucide-react") @react.component
  external make: (~className: string=?) => React.element = "Sun"
}

type buttonVariantOptions = {
  variant: string,
  size: string,
}

@module("../components/ui/button")
external buttonVariants: buttonVariantOptions => string = "buttonVariants"
