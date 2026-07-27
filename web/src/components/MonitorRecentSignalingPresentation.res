let sectionId = "recent-signaling"

let windowLabel = window =>
  switch window {
  | RecentSignaling.Blocks48 => "48"
  | RecentSignaling.Blocks72 => "72"
  | RecentSignaling.Blocks144 => "144"
  }

let blockInputs = (blocks: Nullable.t<array<Monitor.monitorBlockWire>>) =>
  blocks
  ->Nullable.toOption
  ->Option.map(blocks =>
    blocks->Array.map((block: Monitor.monitorBlockWire): RecentSignaling.signalingBlock => {
      height: block.height,
      signaling: block.signaling,
    })
  )
  ->Option.getOr([])

@react.component
let make = (
  ~blockDataStatus,
  ~blocks,
  ~cacheInfo,
  ~data: Monitor.monitorData,
  ~onWindowChange,
  ~windowSize,
) => {
  let recent = RecentSignaling.recentSignaling(blockInputs(blocks), windowSize)
  let unavailable = recent.sampled === 0

  <Ui.Card id=sectionId className="scroll-mt-24 border-border/50 bg-card/50 backdrop-blur">
    <Ui.CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {React.string("Recent signaling")}
        </p>
        <Ui.CardTitle className="mt-1 text-xl font-semibold tracking-tight">
          <a
            href={`#${sectionId}`}
            className="inline-flex w-fit rounded-sm text-current transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {React.string(RecentSignaling.recentWindowHeading(windowSize))}
          </a>
        </Ui.CardTitle>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {blockDataStatus === #live
          ? <Ui.Badge
              variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 text-primary"
            >
              <span className="size-1.5 rounded-full bg-current animate-pulse" ariaHidden=true />
              {React.string("Live")}
            </Ui.Badge>
          : React.null}
        {switch cacheInfo->Nullable.toOption {
        | Some(cacheInfo: MonitorDataController.cacheInfo) =>
          <span className="text-xs text-muted-foreground">
            {React.string(
              `Updated ${MonitorDashboardModel.formatCacheAge(cacheInfo.cachedAt, Date.now())}`,
            )}
          </span>
        | None => React.null
        }}
        <span
          className="inline-flex rounded-lg bg-muted p-1"
          role="group"
          ariaLabel="Recent signaling window"
        >
          {RecentSignaling.recentWindows
          ->Array.map(size => {
            let selected = windowSize === size

            <button
              key={windowLabel(size)}
              ariaLabel={RecentSignaling.recentWindowHeading(size)}
              ariaPressed={selected ? #"true" : #"false"}
              onClick={_ => onWindowChange(size)}
              type_="button"
              className={Ui.buttonVariants({
                variant: selected ? "default" : "ghost",
                size: "xs",
              })}
            >
              {React.string(windowLabel(size))}
            </button>
          })
          ->React.array}
        </span>
      </div>
    </Ui.CardHeader>
    <Ui.CardContent>
      <p className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
        {React.string(unavailable ? "N/A" : MonitorDashboardModel.formatPercent(recent.pct))}
      </p>
      <p className="mt-3 max-w-2xl text-sm text-foreground/80">
        {React.string(RecentSignaling.recentSignalingCounts(recent))}
      </p>
      {unavailable
        ? React.null
        : <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {React.string(RecentSignaling.recentSignalingDetail(recent, data.periodNum))}
          </p>}
    </Ui.CardContent>
  </Ui.Card>
}
