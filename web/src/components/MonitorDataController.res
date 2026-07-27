type cacheSource = [#cache | #network]

type cacheInfo = {
  cachedAt: float,
  source: cacheSource,
}

type loadedContent = {
  data: Monitor.monitorData,
  cacheInfo: cacheInfo,
}

type content =
  | Empty
  | Loaded(loadedContent)

type requestStatus =
  | InitialLoading
  | Idle
  | Refreshing
  | BackgroundRefreshing

type state = {
  content: content,
  error: option<string>,
  requestStatus: requestStatus,
}

type controller = {
  state: state,
  refresh: unit => unit,
}

let cacheTtlMs = 60_000

let emptyState = {
  content: Empty,
  error: None,
  requestStatus: InitialLoading,
}

let cachedIsStale = cached =>
  MonitorDashboardModel.isCacheStale(
    cached.MonitorDashboardClient.cachedAt,
    MonitorDashboardClient.now(),
    ~ttlMs=cacheTtlMs,
  )

let withLoadedContent = (cached: MonitorDashboardClient.cachedMonitorData, source) => {
  content: Loaded({
    data: cached.data,
    cacheInfo: {
      cachedAt: cached.cachedAt,
      source,
    },
  }),
  error: None,
  requestStatus: Idle,
}

let useMonitorData = (~refreshIntervalMs: option<int>, ~refreshOnFocus, ~listenForCacheEvents) => {
  let (state, setState) = React.useState(() => emptyState)
  let active = React.useRef(true)
  let refreshInFlight = React.useRef(false)

  let refreshData = React.useCallback0((~signal, ~background) => {
    if !refreshInFlight.current {
      refreshInFlight.current = true
      setState(state => {
        ...state,
        error: None,
        requestStatus: background
          ? BackgroundRefreshing
          : switch state.content {
            | Empty => InitialLoading
            | Loaded(_) => Refreshing
            },
      })

      let run = async () => {
        try {
          let data = await MonitorDashboardClient.fetchMonitorData(signal)

          if active.current {
            let cachedAt = MonitorDashboardClient.now()
            setState(_ => withLoadedContent({cachedAt, data}, #network))
            MonitorDashboardClient.writeCachedMonitorData(data, cachedAt)
          }
        } catch {
        | error =>
          if active.current {
            setState(state => {
              ...state,
              error: MonitorDashboardClient.isAbortError(error)
                ? state.error
                : Some(
                    MonitorDashboardClient.errorMessage(error, "Monitor data could not be loaded"),
                  ),
              requestStatus: Idle,
            })
          }
        }

        refreshInFlight.current = false
      }

      run()->ignore
    }
  })

  React.useEffect3(() => {
    active.current = true
    let controller = MonitorDashboardClient.makeAbortController()
    let cached = MonitorDashboardClient.readCachedMonitorData()->Nullable.toOption

    switch cached {
    | Some(cached) => setState(_ => withLoadedContent(cached, #cache))
    | None => ()
    }

    switch cached {
    | Some(cached) if !cachedIsStale(cached) => ()
    | Some(_) | None =>
      refreshData(
        ~signal=controller->MonitorDashboardClient.abortControllerSignal->Nullable.make,
        ~background=false,
      )
    }

    let stopFocusWatch = refreshOnFocus
      ? MonitorDashboardClient.watchFocusAndVisibility(() => {
          if MonitorDashboardClient.isPageVisible() {
            switch MonitorDashboardClient.readCachedMonitorData()->Nullable.toOption {
            | Some(cached) if !cachedIsStale(cached) => ()
            | Some(_) | None => refreshData(~signal=Nullable.null, ~background=false)
            }
          }
        })
      : () => ()
    let stopCacheWatch = listenForCacheEvents
      ? MonitorDashboardClient.watchMonitorData(cached =>
          setState(_ => withLoadedContent(cached, #cache))
        )
      : () => ()
    let stopInterval = switch refreshIntervalMs {
    | Some(milliseconds) => MonitorDashboardClient.setInterval(() => {
        if MonitorDashboardClient.isPageVisible() {
          refreshData(~signal=Nullable.null, ~background=true)
        }
      }, milliseconds)
    | None => () => ()
    }

    Some(
      () => {
        active.current = false
        controller->MonitorDashboardClient.abortRequest
        stopFocusWatch()
        stopCacheWatch()
        stopInterval()
      },
    )
  }, (refreshIntervalMs, refreshOnFocus, listenForCacheEvents))

  let refresh = React.useCallback0(() => refreshData(~signal=Nullable.null, ~background=false))

  {state, refresh}
}

let data = state =>
  switch state.content {
  | Empty => Nullable.null
  | Loaded(content) => Nullable.make(content.data)
  }

let cacheInfo = state =>
  switch state.content {
  | Empty => Nullable.null
  | Loaded(content) => Nullable.make(content.cacheInfo)
  }

let error = state => state.error->Nullable.fromOption

let loading = state =>
  switch (state.content, state.requestStatus) {
  | (Empty, InitialLoading) => true
  | (Empty, Idle | Refreshing | BackgroundRefreshing)
  | (Loaded(_), _) => false
  }

let refreshing = state => state.requestStatus === Refreshing
