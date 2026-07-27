@react.component
let make = () => {
  let (preference, setPreference) = React.useState(() =>
    ThemePreference.initial(Nullable.null, false)
  )
  let (mounted, setMounted) = React.useState(() => false)

  React.useEffect0(() => {
    setMounted(_ => true)
    setPreference(_ =>
      ThemePreference.initial(
        Browser.getLocalStorageItem("theme"),
        Browser.prefersDarkColorScheme(),
      )
    )

    let unsubscribe = Browser.watchDarkColorScheme(dark => {
      setPreference(preference => ThemePreference.systemChanged(preference, dark))
    })

    Some(unsubscribe)
  })

  React.useEffect2(() => {
    if mounted {
      let dark = preference->ThemePreference.isDark
      Browser.setDocumentDarkClass(dark)

      switch preference->ThemePreference.storageValue->Nullable.toOption {
      | Some(value) => Browser.setLocalStorageItem("theme", value)
      | None => ()
      }
    }

    None
  }, (preference, mounted))

  <button
    type_="button"
    className={`${Ui.buttonVariants({variant: "ghost", size: "icon"})} rounded-full`}
    dataTestId="js-only"
    onClick={_ => setPreference(ThemePreference.toggle)}
  >
    <span ariaHidden=true>
      {mounted && preference->ThemePreference.isDark
        ? <Ui.Sun className="h-5 w-5" />
        : <Ui.Moon className="h-5 w-5" />}
    </span>
    <span className="sr-only"> {React.string("Toggle theme")} </span>
  </button>
}
