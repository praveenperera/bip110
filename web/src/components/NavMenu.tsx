import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

const sections = [
  { label: "Key Points", href: "/#key" },
  { label: "Run BIP-110", href: "/#run" },
  { label: "Why", href: "/#why" },
  { label: "How It Works", href: "/#how" },
  { label: "FAQ", href: "/#faq" },
  { label: "Articles", href: "/#articles" },
  { label: "Tradeoffs", href: "/#tradeoffs" },
  { label: "Timeline", href: "/#timeline" },
];

const pages = [
  { label: "Home", href: "/" },
  { label: "Monitor", href: "/monitor" },
  { label: "How To", href: "/howto" },
  { label: "Code Walkthrough", href: "/code-walkthrough" },
  { label: "Articles", href: "/articles" },
];

const mobileLinkClass =
  "px-3 py-1.5 rounded-md text-sm hover:bg-accent hover:text-accent-foreground transition-colors";

const normalizePath = (path: string) => path.replace(/\/+$/, "") || "/";

function NavLink({
  href,
  active,
  hasDropdown,
  children,
}: {
  href: string;
  active: boolean;
  hasDropdown?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`relative px-3 py-1.5 text-[13px] font-medium tracking-wide uppercase transition-colors duration-200 group flex items-center gap-1 ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {hasDropdown && (
        <svg
          className="w-3 h-3 opacity-40 group-hover:opacity-70 transition-all duration-200 group-hover:translate-y-px"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      )}
      <span
        className={`absolute bottom-0 left-3 right-3 h-px transition-all duration-300 ease-out ${
          active
            ? "bg-primary scale-x-100"
            : "bg-foreground/40 scale-x-0 group-hover:scale-x-100"
        }`}
        style={{ transformOrigin: "left" }}
      />
    </a>
  );
}

function DesktopNav() {
  const [showSections, setShowSections] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [currentPath, setCurrentPath] = useState("/");

  useEffect(() => {
    setCurrentPath(normalizePath(window.location.pathname));
  }, []);

  const open = () => {
    clearTimeout(timeoutRef.current);
    setShowSections(true);
  };

  const close = () => {
    timeoutRef.current = setTimeout(() => setShowSections(false), 180);
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const isHome = currentPath === "/";

  return (
    <nav className="hidden md:flex items-center gap-0.5">
      <div
        ref={menuRef}
        className="relative"
        onMouseEnter={open}
        onMouseLeave={close}
      >
        <NavLink href="/" active={isHome} hasDropdown>
          Home
        </NavLink>

        <div
          className={`absolute top-full left-0 pt-2 transition-all duration-200 ${
            showSections
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-1 pointer-events-none"
          }`}
        >
          <div className="w-52 bg-card/95 backdrop-blur-lg border border-border/30 rounded-xl shadow-xl shadow-black/5 dark:shadow-black/20 p-2">
            <p className="px-3 pt-1.5 pb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/60">
              Jump to section
            </p>
            {sections.map((section) => (
              <a
                key={section.href}
                href={section.href}
                onClick={() => setShowSections(false)}
                className="block px-3 py-1.5 text-[13px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors duration-150"
              >
                {section.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <NavLink href="/howto" active={currentPath === "/howto"}>
        How To
      </NavLink>
      <NavLink href="/monitor" active={currentPath === "/monitor"}>
        Monitor
      </NavLink>
      <NavLink
        href="/code-walkthrough"
        active={currentPath === "/code-walkthrough"}
      >
        Code
      </NavLink>
      <NavLink href="/articles" active={currentPath.startsWith("/articles")}>
        Articles
      </NavLink>
    </nav>
  );
}

function MobileNav() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative md:hidden" data-js-only>
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        {open ? (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        )}
      </Button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-border/50 rounded-xl shadow-lg p-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Pages
            </p>
            <div className="space-y-1">
              {pages.map((page) => (
                <a
                  key={page.href}
                  href={page.href}
                  onClick={() => setOpen(false)}
                  className={`block ${mobileLinkClass}`}
                >
                  {page.label}
                </a>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50" />

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Sections
            </p>
            <div className="space-y-1">
              {sections.map((section) => (
                <a
                  key={section.href}
                  href={section.href}
                  onClick={() => setOpen(false)}
                  className={`block ${mobileLinkClass}`}
                >
                  {section.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function NavMenu() {
  return (
    <>
      <DesktopNav />
      <MobileNav />
    </>
  );
}
