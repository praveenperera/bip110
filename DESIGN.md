---
name: BIP-110
description: Public advocacy and operator support site for the BIP-110 temporary consensus soft fork.
colors:
  signal-amber: "oklch(0.75 0.18 55)"
  ink-light: "oklch(0.145 0 0)"
  paper-light: "oklch(0.985 0 0)"
  card-light: "oklch(1 0 0)"
  muted-light: "oklch(0.97 0 0)"
  muted-ink-light: "oklch(0.5 0 0)"
  rule-light: "oklch(0.9 0 0)"
  ink-dark: "oklch(0.95 0 0)"
  paper-dark: "oklch(0.12 0 0)"
  card-dark: "oklch(0.18 0 0)"
  muted-dark: "oklch(0.22 0 0)"
  muted-ink-dark: "oklch(0.65 0 0)"
  rule-dark: "oklch(1 0 0 / 12%)"
  destructive: "oklch(0.577 0.245 27.325)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem to 3.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem to 1.25rem"
    fontWeight: 600
    lineHeight: 1.375
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem to 0.8125rem"
    fontWeight: 500
    lineHeight: 1.333
    letterSpacing: "0.025em"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section-y: "96px"
components:
  button-primary:
    backgroundColor: "{colors.signal-amber}"
    textColor: "{colors.paper-dark}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    height: "32px"
  button-outline:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink-light}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "8px 10px"
    height: "32px"
  badge-outline:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink-light}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  card:
    backgroundColor: "{colors.card-light}"
    textColor: "{colors.ink-light}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "16px"
  monitor-block:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.muted-ink-light}"
    typography: "{typography.code}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "48px"
---

# Design System: BIP-110

## 1. Overview

**Creative North Star: "The Protocol Ledger"**

BIP-110 should feel like a public technical record that can also move an operator to act. The design is restrained, amber-led, and structurally quiet: thin rules, compact components, muted surfaces, and a small number of decisive highlighted states. The system earns trust by making claims easy to inspect.

The atmosphere is principled, exact, and calm. It rejects crypto-hype aesthetics, generic SaaS polish, and protocol-paper density as the dominant mode. The site may carry long-form argument, but the interface should keep a node operator oriented: what changed, what matters now, what action is available, and where the source lives.

**Key Characteristics:**
- restrained amber signal over neutral chain-ash surfaces
- compact shadcn/base-ui primitives with visible focus and thin borders
- mostly flat elevation, with depth created by tonal contrast, border strength, and occasional blur
- technical monitor grids as the signature data texture
- system typography with strong weight contrast, not decorative font personality

## 2. Colors

The palette is Signal Amber against Chain Ash: amber marks activation, support, links, and progress; neutral surfaces carry the argument.

### Primary
- **Signal Amber**: The only brand accent. Use it for BIP-110 identity, primary actions, links, progress fills, signaling blocks, and verified live status. Its role is operational signal, not decoration.

### Neutral
- **Paper Light**: The default light page background. Use for ordinary reading surfaces and the outline button background.
- **Ink Light**: Primary text in light mode. Use for headings, body text, and active navigation.
- **Card Light**: Card and popover surface in light mode. It is often softened with opacity in page sections.
- **Muted Light**: Secondary background for grouped panels, accordions, and inactive progress tracks.
- **Muted Ink Light**: Secondary text and metadata in light mode. Do not use it for actionable labels or critical compatibility claims.
- **Rule Light**: Borders, table rules, separators, card rings, and quiet outlines.
- **Paper Dark**: The default dark page background. It should stay near-black but not pure black.
- **Ink Dark**: Primary text in dark mode. Use with slightly more line-height when paragraphs sit on dark surfaces.
- **Card Dark**: Card and popover surface in dark mode.
- **Muted Dark**: Secondary dark surface for grouped panels.
- **Muted Ink Dark**: Secondary text and metadata in dark mode.
- **Rule Dark**: Dark-mode dividers and borders.

### Tertiary
- **Destructive Red**: Error and unavailable states only. Never use it as a general urgency color.

### Named Rules
**The One Signal Rule.** Signal Amber is the only recurring accent. Do not introduce additional brand colors unless a data visualization needs separate semantic categories.

**The No Crypto Costume Rule.** Do not use neon gradients, purple-blue Web3 palettes, token-chart greens, or trader-dashboard color systems.

## 3. Typography

**Display Font:** system sans (`ui-sans-serif, system-ui, sans-serif`)
**Body Font:** system sans (`ui-sans-serif, system-ui, sans-serif`)
**Label/Mono Font:** system mono (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`)

**Character:** The typography is native, utilitarian, and low-latency. It should feel like an operator interface and a technical brief sharing the same spine, not a magazine or a crypto campaign.

### Hierarchy
- **Display** (700, `2.25rem` to `3.75rem`, tight line-height): Hero headings and major route titles only. Keep tracking tight and direct.
- **Headline** (700, `1.875rem`, compact line-height): Section headings such as "Key Points", "Run BIP-110", and monitor section titles.
- **Title** (600, `1.125rem` to `1.25rem`, snug line-height): Card titles, table sections, and status panel headings.
- **Body** (400, `1rem`, relaxed line-height): Explanatory text, FAQ answers, installation content, and article descriptions. Keep long paragraphs near 65 to 75 characters.
- **Label** (500, `0.75rem` to `0.8125rem`, uppercase allowed with `0.025em` tracking): Status labels, table headers, metadata, badges, and dashboard microcopy.
- **Code** (400, `0.875rem`, mono): Block heights, hashes, versions, snippets, progress values, and technical details. Use mono only where the content is actually technical.

### Named Rules
**The Native Precision Rule.** System fonts are part of the product posture. Do not swap in a decorative display family unless the whole brand direction is being intentionally revised.

**The Mono Earns Its Place Rule.** Monospace is for block data, hashes, version strings, commands, and technical details. It is forbidden as a lazy signifier for "Bitcoin" or "developer".

## 4. Elevation

The system is flat by default. Depth comes from borders, tonal layers, opacity, and occasional blur on fixed navigation or popovers. Shadows exist only for overlays, hovered media, and monitor surfaces where separation is functional.

### Shadow Vocabulary
- **Surface Trace** (`box-shadow: 0 1px 2px oklch(0.145 0 0 / 5%)`): Used sparingly on monitor status panels and outline hero actions.
- **Dropdown Lift** (`box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05)`): Navigation menus only.
- **Tooltip Lift** (`box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25)`): Dense block tooltips that must float above the grid.
- **Inset Signal** (`box-shadow: inset 0 -3px 0 var(--primary)`): Signaling block tiles only.

### Named Rules
**The Flat Record Rule.** Static content surfaces are flat at rest. If a card needs attention, use stronger hierarchy, a full border, or a pale amber fill before adding shadow.

**The Overlay Exception Rule.** Shadows belong to temporary layers: menus, tooltips, and data inspection states.

## 5. Components

Components should be precise, quiet, and actionable. They are compact enough for monitor data but clear enough for public advocacy content.

### Buttons
- **Shape:** Gently squared controls (`8px` radius), with circular icon buttons only for single-symbol utilities such as theme and menu toggles.
- **Primary:** Signal Amber background with dark foreground, compact height (`32px`) in app primitives and larger custom CTAs (`44px` to `48px`) where the page needs a primary route.
- **Hover / Focus:** Hover darkens the amber or shifts outline buttons to muted surfaces. Focus uses a visible ring (`3px`) in Signal Amber at reduced opacity.
- **Secondary / Ghost / Tertiary:** Outline and ghost buttons are the default for navigation and utility actions. Link buttons use Signal Amber text and underline on hover.

### Chips
- **Style:** Badges are compact pills (`20px` height, fully rounded), using Signal Amber for active status and neutral outlines for metadata.
- **State:** Live or synced states may use amber text and amber border. Passive metadata stays neutral.

### Cards / Containers
- **Corner Style:** Main cards use a soft rectangular radius (`12px`). Nested data cells use `8px`.
- **Background:** Cards use Card Light or Card Dark, often at 50 to 70 percent opacity over the page.
- **Shadow Strategy:** Flat by default. Use Surface Trace only on monitor summary panels or when separation is not clear from borders alone.
- **Border:** Thin neutral borders are standard. Amber borders mark active, synced, signaling, or important callout states.
- **Internal Padding:** Standard cards use `16px` to `24px`. Dense monitor cells use `12px` to `16px`.

### Inputs / Fields
- **Style:** No broad form system is currently established. Any future field should use background, border, text, and ring tokens from the button system.
- **Focus:** Use the existing focus-ring language: Signal Amber ring at reduced opacity plus a clear border.
- **Error / Disabled:** Error fields use Destructive Red text or border with pale destructive background. Disabled controls reduce opacity to 50 percent.

### Navigation
- **Style:** Fixed top navigation uses a translucent background (`background / 80%`), backdrop blur, a faint bottom border, uppercase `13px` labels, and a single-pixel active underline.
- **States:** Active routes use Signal Amber. Hover states shift neutral text toward primary text and expand an underline from the left.
- **Mobile:** Mobile navigation is a compact dropdown card with page links and section links separated by a thin neutral rule.

### Monitor Block Grid
- **Style:** Block tiles are `48px` high, mono, rounded `6px`, and arranged in an auto-fill grid.
- **Default State:** Neutral border, paper background, muted text.
- **Signaling State:** Pale amber fill, amber text, and the Inset Signal shadow.
- **Clean State:** A low-opacity amber outline marks blocks with zero BIP-110 violations, independently of signaling and without changing the tile fill.
- **Unavailable State:** Missing violation data receives no visual treatment and makes no cleanliness claim.
- **Interaction:** Hover and focus may move the tile up by `0.5px`; this is data inspection feedback, not decorative motion.

### Technical Accordions
- **Style:** FAQ and technical detail accordions are border-first, flat, and readable without JavaScript.
- **State:** Open FAQ rows may strengthen the amber border. Technical detail panels use muted backgrounds with mono text.

## 6. Do's and Don'ts

### Do:
- **Do** use Signal Amber for activation, support, progress, links, and selected states.
- **Do** keep public pages readable first: center summaries when useful, but cap long body copy around 65 to 75 characters.
- **Do** use thin full borders, pale fills, and clear hierarchy before adding shadows.
- **Do** preserve keyboard focus rings on every button, nav item, accordion trigger, and monitor block.
- **Do** make monitor data inspectable through labels, tooltips, source links, and stable mono formatting.
- **Do** use cards only for grouped information, install paths, monitor status, article entries, and FAQ rows.

### Don't:
- **Don't** use crypto-hype aesthetics: neon-on-black, trader dashboards, speculative language, meme-token energy, countdown urgency, inflated promises, or decorative Web3 tropes.
- **Don't** use generic SaaS landing-page patterns when they weaken credibility: soft gradient hero stacks, repeated icon cards, vague value propositions, oversized metrics, or polish detached from protocol reality.
- **Don't** make the site feel like an academic paper as the dominant mode. Technical depth must stay navigable and actionable for node operators.
- **Don't** add gradient text. Use solid text color and hierarchy instead.
- **Don't** use `border-left` or `border-right` greater than `1px` as a colored accent on cards, list items, callouts, or alerts.
- **Don't** add decorative glassmorphism. Blur is reserved for fixed navigation and temporary overlay separation.
- **Don't** introduce new rounded icon-card grids unless each card is a real action, status, or content object.
