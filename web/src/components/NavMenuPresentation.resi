/** Renders responsive navigation from ReScript-owned state */
@react.component
let make: (
  ~articlesActive: bool,
  ~codeActive: bool,
  ~desktopOpen: bool,
  ~homeActive: bool,
  ~howToActive: bool,
  ~mobileOpen: bool,
  ~monitorActive: bool,
  ~onDesktopEnter: unit => unit,
  ~onDesktopLeave: unit => unit,
  ~onLinkClick: unit => unit,
  ~onMobileMenuRef: Nullable.t<NavMenuClient.domElement> => unit,
  ~onMobileToggle: unit => unit,
) => React.element
