type dataStatus = [#loading | #live | #unavailable]

type state = {
  blocks: option<array<Monitor.monitorBlockWire>>,
  status: dataStatus,
}

type controller = {
  state: state,
  refresh: unit => unit,
}

let refreshIntervalMs = 10_000
let staleAfterMs = 60_000

let useMonitorBlocks = expectedTip => {
  let (state, setState) = React.useState(() => {
    blocks: None,
    status: #loading,
  })
  let (refreshIndex, setRefreshIndex) = React.useState(() => 0)
  let lastLoadedAt = React.useRef(None)

  React.useEffect2(() => {
    let active = ref(true)
    let loading = ref(false)
    let requestController = ref(None)

    let loadBlocks = async () => {
      if !loading.contents && MonitorDashboardClient.isPageVisible() {
        loading.contents = true
        let controller = MonitorDashboardClient.makeAbortController()
        requestController.contents = Some(controller)

        try {
          let payload = await MonitorDashboardClient.fetchMonitorBlocks(
            expectedTip,
            controller->MonitorDashboardClient.abortControllerSignal->Nullable.make,
          )

          if active.contents {
            lastLoadedAt.current = Some(MonitorDashboardClient.now())
            setState(_ => {
              blocks: Some(payload.blocks),
              status: #live,
            })
          }
        } catch {
        | error =>
          if active.contents && !MonitorDashboardClient.isAbortError(error) {
            setState(state => {
              ...state,
              status: #unavailable,
            })
          }
        }

        loading.contents = false
      }
    }

    let loadBlocksIfStale = () => {
      let stale = switch lastLoadedAt.current {
      | Some(loadedAt) =>
        MonitorDashboardModel.isCacheStale(
          loadedAt,
          MonitorDashboardClient.now(),
          ~ttlMs=staleAfterMs,
        )
      | None => true
      }

      if stale {
        loadBlocks()->ignore
      }
    }

    loadBlocks()->ignore
    let stopInterval = MonitorDashboardClient.setInterval(
      () => loadBlocks()->ignore,
      refreshIntervalMs,
    )
    let stopFocusWatch = MonitorDashboardClient.watchFocusAndVisibility(loadBlocksIfStale)

    Some(
      () => {
        active.contents = false
        switch requestController.contents {
        | Some(controller) => controller->MonitorDashboardClient.abortRequest
        | None => ()
        }
        stopInterval()
        stopFocusWatch()
      },
    )
  }, (expectedTip, refreshIndex))

  let refresh = React.useCallback0(() => setRefreshIndex(index => index + 1))

  {state, refresh}
}

let blocks = state => state.blocks->Nullable.fromOption
let status = state => state.status
