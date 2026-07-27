@genType
type attributionState = {
  status: [#idle | #loading | #loaded | #unavailable],
  attribution: Nullable.t<Monitor.blockMiningAttribution>,
}

type attributionEntry = {
  hash: string,
  state: attributionState,
}

type chartMetricController = {
  metric: MonitorDashboardModel.periodChartMetric,
  selectMetric: MonitorDashboardModel.periodChartMetric => unit,
}

type recentWindowController = {
  window: RecentSignaling.window,
  selectWindow: RecentSignaling.window => unit,
}

type gridExpansionController = {
  showAll: bool,
  showAllBlocks: unit => unit,
}

type blockAttributionController = {
  attributionForHash: string => attributionState,
  loadAttribution: string => unit,
}

type gridController = {
  showAllBlocks: bool,
  expandBlocks: unit => unit,
  attributionState: string => attributionState,
  loadAttribution: string => unit,
}

type dashboardController = {
  now: float,
  chartMetric: MonitorDashboardModel.periodChartMetric,
  selectChartMetric: MonitorDashboardModel.periodChartMetric => unit,
  recentWindow: RecentSignaling.window,
  selectRecentWindow: RecentSignaling.window => unit,
  grid: gridController,
}

let idleAttribution = {
  status: #idle,
  attribution: Nullable.null,
}

let attributionForHash = (entries, hash) =>
  entries
  ->Array.find(entry => entry.hash === hash)
  ->Option.map(entry => entry.state)
  ->Option.getOr(idleAttribution)

let withAttribution = (entries, hash, state) =>
  Array.concat([{hash, state}], entries->Array.filter(entry => entry.hash !== hash))

let useBlockAttribution = () => {
  let (entries, setEntries) = React.useState(() => [])
  let active = React.useRef(true)

  React.useEffect0(() => {
    active.current = true
    Some(() => active.current = false)
  })

  let stateForHash = React.useCallback1(hash => attributionForHash(entries, hash), [entries])

  let load = React.useCallback1(hash => {
    if attributionForHash(entries, hash).status === #idle {
      setEntries(entries =>
        withAttribution(
          entries,
          hash,
          {
            status: #loading,
            attribution: Nullable.null,
          },
        )
      )

      let run = async () => {
        try {
          let attribution = await MonitorDashboardClient.fetchBlockMiningAttribution(hash)

          if active.current {
            setEntries(entries =>
              withAttribution(
                entries,
                hash,
                {
                  status: #loaded,
                  attribution,
                },
              )
            )
          }
        } catch {
        | _ =>
          if active.current {
            setEntries(entries =>
              withAttribution(
                entries,
                hash,
                {
                  status: #unavailable,
                  attribution: Nullable.null,
                },
              )
            )
          }
        }
      }

      run()->ignore
    }
  }, [entries])

  {
    attributionForHash: stateForHash,
    loadAttribution: load,
  }
}

let useGridExpansion = (~periodNum, ~tip, ~mode) => {
  let (showAll, setShowAll) = React.useState(() => false)

  React.useEffect3(() => {
    setShowAll(_ => false)
    None
  }, (periodNum, tip, mode))

  let showAllBlocks = React.useCallback0(() => setShowAll(_ => true))

  {
    showAll,
    showAllBlocks,
  }
}

let readRecentWindow = () =>
  MonitorDashboardClient.recentWindowQueryValue()->RecentSignaling.parseRecentWindow

let useClock = () => {
  let (now, setNow) = React.useState(MonitorDashboardClient.now)

  React.useEffect0(() => Some(
    MonitorDashboardClient.setInterval(() => setNow(_ => MonitorDashboardClient.now()), 1_000),
  ))

  now
}

let useChartMetric = () => {
  let (metric, setMetric) = React.useState(() => #percentage)
  let selectMetric = React.useCallback0(metric => setMetric(_ => metric))

  {metric, selectMetric}
}

let useRecentWindow = () => {
  let (window, setWindow) = React.useState(() => RecentSignaling.defaultRecentWindow)

  React.useEffect0(() => {
    let syncFromLocation = () => setWindow(_ => readRecentWindow())
    syncFromLocation()
    Some(MonitorDashboardClient.watchPopState(syncFromLocation))
  })

  let selectWindow = React.useCallback0(nextWindow => {
    setWindow(_ => nextWindow)
    RecentSignaling.recentWindowSearch(
      MonitorDashboardClient.locationSearch(),
      nextWindow,
    )->MonitorDashboardClient.replaceRecentWindowLocation
  })

  {
    window,
    selectWindow,
  }
}

let useGrid = (~periodNum, ~tip, ~mode) => {
  let expansion = useGridExpansion(~periodNum, ~tip, ~mode)
  let attribution = useBlockAttribution()

  {
    showAllBlocks: expansion.showAll,
    expandBlocks: expansion.showAllBlocks,
    attributionState: attribution.attributionForHash,
    loadAttribution: attribution.loadAttribution,
  }
}

let useDashboard = (~periodNum, ~tip) => {
  let now = useClock()
  let chart = useChartMetric()
  let recent = useRecentWindow()
  let grid = useGrid(~periodNum, ~tip, ~mode="bip110")

  {
    now,
    chartMetric: chart.metric,
    selectChartMetric: chart.selectMetric,
    recentWindow: recent.window,
    selectRecentWindow: recent.selectWindow,
    grid,
  }
}
