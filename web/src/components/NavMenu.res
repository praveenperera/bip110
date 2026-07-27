let closeDelayMs = 180

let rec normalizePath = path =>
  if path === "" {
    "/"
  } else if path->String.length > 1 && path->String.endsWith("/") {
    normalizePath(path->String.slice(~start=0, ~end=path->String.length - 1))
  } else {
    path
  }

@react.component
let make = () => {
  let (currentPath, setCurrentPath) = React.useState(() => "/")
  let (desktopOpen, setDesktopOpen) = React.useState(() => false)
  let (mobileOpen, setMobileOpen) = React.useState(() => false)
  let closeTimeout = React.useRef(None)
  let mobileMenuElement = React.useRef(None)

  let clearCloseTimeout = () => {
    switch closeTimeout.current {
    | Some(timeout) => {
        timeout->NavMenuClient.clearTimeout
        closeTimeout.current = None
      }
    | None => ()
    }
  }

  React.useEffect0(() => {
    setCurrentPath(_ => NavMenuClient.currentPathname()->normalizePath)
    Some(clearCloseTimeout)
  })

  React.useEffect1(() => {
    if mobileOpen {
      Some(
        NavMenuClient.watchMobileDismiss(
          () => mobileMenuElement.current,
          () => setMobileOpen(_ => false),
        ),
      )
    } else {
      None
    }
  }, [mobileOpen])

  let openDesktop = () => {
    clearCloseTimeout()
    setDesktopOpen(_ => true)
  }
  let closeDesktop = () => {
    clearCloseTimeout()
    closeTimeout.current = Some(NavMenuClient.setTimeout(() => {
        closeTimeout.current = None
        setDesktopOpen(_ => false)
      }, closeDelayMs))
  }
  let closeMenus = () => {
    clearCloseTimeout()
    setDesktopOpen(_ => false)
    setMobileOpen(_ => false)
  }

  <NavMenuPresentation
    articlesActive={currentPath->String.startsWith("/articles")}
    codeActive={currentPath === "/code-walkthrough"}
    desktopOpen
    homeActive={currentPath === "/"}
    howToActive={currentPath === "/howto"}
    mobileOpen
    monitorActive={currentPath === "/monitor"}
    onDesktopEnter={openDesktop}
    onDesktopLeave={closeDesktop}
    onLinkClick={closeMenus}
    onMobileMenuRef={element => mobileMenuElement.current = element->Nullable.toOption}
    onMobileToggle={() => setMobileOpen(isOpen => !isOpen)}
  />
}
