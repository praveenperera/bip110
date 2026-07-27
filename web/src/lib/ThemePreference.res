@genType
type theme = [#light | #dark]

@genType
type source = [#system | #explicit]

@genType
type model = {
  theme: theme,
  source: source,
}

let systemTheme = dark => dark ? #dark : #light

@genType
let initial = (stored, systemDark) =>
  switch stored->Nullable.toOption {
  | Some("dark") => {theme: #dark, source: #explicit}
  | Some("light") => {theme: #light, source: #explicit}
  | Some(_)
  | None => {theme: systemTheme(systemDark), source: #system}
  }

@genType
let systemChanged = (model, dark) =>
  switch model.source {
  | #system => {...model, theme: systemTheme(dark)}
  | #explicit => model
  }

@genType
let toggle = model => {
  theme: model.theme === #light ? #dark : #light,
  source: #explicit,
}

@genType
let isDark = model => model.theme === #dark

@genType
let storageValue = model =>
  switch model.source {
  | #system => Nullable.null
  | #explicit => Nullable.make(model.theme === #dark ? "dark" : "light")
  }
