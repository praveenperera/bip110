/** Effective document theme */
@genType
type theme = [#light | #dark]

/** Provenance of the effective theme */
@genType
type source = [#system | #explicit]

/** Effective theme and whether the user selected it explicitly */
@genType
type model = {
  theme: theme,
  source: source,
}

/** Resolves stored and system preferences without persisting the system value */
@genType
let initial: (Nullable.t<string>, bool) => model

/** Applies a system-theme change only while the preference remains system-derived */
@genType
let systemChanged: (model, bool) => model

/** Toggles the effective theme and marks the result explicit */
@genType
let toggle: model => model

/** Returns whether the effective theme is dark */
@genType
let isDark: model => bool

/** Returns a persisted value only for an explicit preference */
@genType
let storageValue: model => Nullable.t<string>
