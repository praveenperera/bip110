type link = {
  label: string,
  href: string,
}

let sections = [
  {label: "Key Points", href: "/#key"},
  {label: "Run BIP-110", href: "/#run"},
  {label: "Why", href: "/#why"},
  {label: "How It Works", href: "/#how"},
  {label: "FAQ", href: "/#faq"},
  {label: "Articles", href: "/#articles"},
  {label: "Tradeoffs", href: "/#tradeoffs"},
  {label: "Timeline", href: "/#timeline"},
]

let pages = [
  {label: "Home", href: "/"},
  {label: "Monitor", href: "/monitor"},
  {label: "How To", href: "/howto"},
  {label: "Code Walkthrough", href: "/code-walkthrough"},
  {label: "Articles", href: "/articles"},
]

let mobileLinkClass = "px-3 py-1.5 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors"

external asMenuElement: nullable<Dom.element> => Nullable.t<NavMenuClient.domElement> = "%identity"

let transformOriginLeft = ReactDOM.Style._dictToStyle(dict{"transformOrigin": "left"})

module NavLink = {
  @react.component
  let make = (~href, ~active, ~hasDropdown=false, ~children) =>
    <a
      href
      className={`relative px-3 py-1.5 text-[13px] font-medium tracking-wide uppercase transition-colors duration-200 group flex items-center gap-1 ${active
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
      {hasDropdown
        ? <span ariaHidden=true>
            <Ui.ChevronDown
              className="w-3 h-3 opacity-40 group-hover:opacity-70 transition-all duration-200 group-hover:translate-y-px"
            />
          </span>
        : React.null}
      <span
        className={`absolute bottom-0 left-3 right-3 h-px transition-all duration-300 ease-out ${active
            ? "bg-primary scale-x-100"
            : "bg-foreground/40 scale-x-0 group-hover:scale-x-100"}`}
        style=transformOriginLeft
      />
    </a>
}

module DesktopNav = {
  @react.component
  let make = (
    ~articlesActive,
    ~codeActive,
    ~desktopOpen,
    ~homeActive,
    ~howToActive,
    ~monitorActive,
    ~onDesktopEnter,
    ~onDesktopLeave,
    ~onLinkClick,
  ) =>
    <nav className="hidden md:flex items-center gap-0.5">
      <div
        className="relative"
        onMouseEnter={_ => onDesktopEnter()}
        onMouseLeave={_ => onDesktopLeave()}
      >
        <NavLink href="/" active=homeActive hasDropdown=true> {React.string("Home")} </NavLink>
        <div
          className={`absolute top-full left-0 pt-2 transition-all duration-200 ${desktopOpen
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-1 pointer-events-none"}`}
        >
          <div
            className="w-52 bg-card/95 backdrop-blur-lg border border-border/30 rounded-xl shadow-xl shadow-black/5 dark:shadow-black/20 p-2"
          >
            <p
              className="px-3 pt-1.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60"
            >
              {React.string("Jump to section")}
            </p>
            {sections
            ->Array.map((section: link) =>
              <a
                key=section.href
                href=section.href
                onClick={_ => onLinkClick()}
                className="block px-3 py-1.5 text-[13px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors duration-150"
              >
                {React.string(section.label)}
              </a>
            )
            ->React.array}
          </div>
        </div>
      </div>
      <NavLink href="/howto" active=howToActive> {React.string("How To")} </NavLink>
      <NavLink href="/monitor" active=monitorActive> {React.string("Monitor")} </NavLink>
      <NavLink href="/code-walkthrough" active=codeActive> {React.string("Code")} </NavLink>
      <NavLink href="/articles" active=articlesActive> {React.string("Articles")} </NavLink>
    </nav>
}

let links = (items, onLinkClick) =>
  items
  ->Array.map((item: link) =>
    <a
      key=item.href
      href=item.href
      onClick={_ => onLinkClick()}
      className={`block ${mobileLinkClass}`}
    >
      {React.string(item.label)}
    </a>
  )
  ->React.array

module MobileNav = {
  @react.component
  let make = (~mobileOpen, ~onLinkClick, ~onMobileMenuRef, ~onMobileToggle) => {
    let menuRef = ReactDOM.Ref.callbackDomRef(element => {
      onMobileMenuRef(asMenuElement(element))
      None
    })

    <div ref=menuRef className="relative md:hidden" dataTestId="js-only">
      <button
        type_="button"
        className={`${Ui.buttonVariants({variant: "ghost", size: "icon"})} rounded-full`}
        onClick={_ => onMobileToggle()}
        ariaLabel={mobileOpen ? "Close menu" : "Open menu"}
        ariaExpanded=mobileOpen
      >
        <span ariaHidden=true>
          {mobileOpen ? <Ui.X className="h-5 w-5" /> : <Ui.Menu className="h-5 w-5" />}
        </span>
      </button>
      {mobileOpen
        ? <div
            className="absolute top-full left-0 mt-2 w-56 bg-card border border-border/50 rounded-xl shadow-lg p-4 space-y-4"
          >
            <div>
              <p
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
              >
                {React.string("Pages")}
              </p>
              <div className="space-y-1"> {links(pages, onLinkClick)} </div>
            </div>
            <div className="border-t border-border/50" />
            <div>
              <p
                className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2"
              >
                {React.string("Sections")}
              </p>
              <div className="space-y-1"> {links(sections, onLinkClick)} </div>
            </div>
          </div>
        : React.null}
    </div>
  }
}

@react.component
let make = (
  ~articlesActive,
  ~codeActive,
  ~desktopOpen,
  ~homeActive,
  ~howToActive,
  ~mobileOpen,
  ~monitorActive,
  ~onDesktopEnter,
  ~onDesktopLeave,
  ~onLinkClick,
  ~onMobileMenuRef,
  ~onMobileToggle,
) =>
  <React.Fragment>
    <DesktopNav
      articlesActive
      codeActive
      desktopOpen
      homeActive
      howToActive
      monitorActive
      onDesktopEnter
      onDesktopLeave
      onLinkClick
    />
    <MobileNav mobileOpen onLinkClick onMobileMenuRef onMobileToggle />
  </React.Fragment>
