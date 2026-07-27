module Tile = {
  @module("./MonitorBlockTileView") @react.component
  external make: (
    ~attributionForHash: string => MonitorDashboardUiController.attributionState,
    ~block: Monitor.monitorGridBlockWire,
    ~mode: string,
    ~onAttributionOpen: string => unit,
  ) => React.element = "MonitorBlockTileView"
}

let sectionId = "block-grid"
let text = React.string

let ursfClass = (mode, base, ursf) => mode === "ursf" ? `${base} ${ursf}` : base

let grid = (
  ~attributionForHash,
  ~blockDataStatus,
  ~blocks,
  ~data: Monitor.monitorData,
  ~mode,
  ~onAttributionOpen,
  ~onShowAllBlocks,
  ~showAllBlocks,
) => {
  let gridBlocks = Monitor.currentPeriodGrid(data, blocks)
  let visibleBlocks = showAllBlocks
    ? gridBlocks
    : gridBlocks->Array.slice(~end=Monitor.monitorGridVisibleBlocks)
  let hiddenCount = max(gridBlocks->Array.length - visibleBlocks->Array.length, 0)
  let hasFirstMinerSignal =
    mode === "bip110" &&
      visibleBlocks->Array.some((block: Monitor.monitorGridBlockWire) =>
        BlockGrid.dashboardBlockPresentation(block, #bip110).firstMinerSignal
      )
  let liveBlockCount =
    blocks->Nullable.toOption->Option.map(blocks => blocks->Array.length)->Option.getOr(0)
  let blockDataLabel = switch blockDataStatus {
  | #live => "Live block data"
  | #loading => "Loading block data"
  | #unavailable => "Block data unavailable"
  }
  let statusClass = ursfClass(
    mode,
    blockDataStatus === #live
      ? "border-border/60 bg-background/70 border-primary/25 text-primary"
      : "border-border/60 bg-background/70",
    "border-[var(--ursf-border)] bg-[var(--ursf-pill)] text-[var(--ursf-muted)]",
  )

  <Ui.Card
    id=sectionId
    className={ursfClass(
      mode,
      "scroll-mt-24 overflow-visible border-border/50 bg-card/50 backdrop-blur",
      "ursf-card border shadow-none",
    )}
  >
    <Ui.CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p
          className={ursfClass(
            mode,
            "text-xs font-medium uppercase tracking-wide text-muted-foreground",
            "ursf-label",
          )}
        >
          {text(mode === "ursf" ? "Recent blocks" : "Current period blocks")}
        </p>
        <Ui.CardTitle
          className={ursfClass(
            mode,
            "mt-1 text-xl font-semibold tracking-tight",
            "ursf-heading font-sans",
          )}
        >
          <a
            href={`#${sectionId}`}
            className={ursfClass(
              mode,
              "inline-flex w-fit rounded-sm text-current transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              "hover:text-[var(--ursf-accent)]",
            )}
          >
            {text(mode === "ursf" ? "All quiet" : "Block signaling grid")}
          </a>
        </Ui.CardTitle>
        <p
          className={ursfClass(mode, "mt-2 max-w-2xl text-sm text-muted-foreground", "ursf-muted")}
        >
          {text(
            `Difficulty period ${MonitorDashboardModel.formatNumber(
                data.periodNum,
              )}: ${MonitorDashboardModel.formatNumber(
                gridBlocks->Array.length,
              )} tracked blocks${mode === "bip110"
                ? `, ${MonitorDashboardModel.formatNumber(data.signalingCount)} signaling`
                : ", 0 URSF signals"}`,
          )}
        </p>
      </div>
      <div
        className={ursfClass(
          mode,
          "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground",
          "ursf-muted",
        )}
      >
        <Ui.Badge variant="outline" className=statusClass> {text(blockDataLabel)} </Ui.Badge>
        <span className="inline-flex items-center gap-2">
          <span className="size-3 rounded-sm bg-primary" ariaHidden=true />
          {text("Signaling")}
        </span>
        <span className="inline-flex items-center gap-2">
          <span
            className={ursfClass(
              mode,
              "size-3 rounded-sm border border-border bg-background",
              "ursf-block-dot border-[var(--ursf-border)]",
            )}
            ariaHidden=true
          />
          {text("Not signaling")}
        </span>
        {mode === "bip110"
          ? <React.Fragment>
              <span className="inline-flex items-center gap-2">
                <span
                  className="size-3 rounded-sm border border-primary/30 bg-background"
                  ariaHidden=true
                />
                {text("Clean")}
              </span>
              {hasFirstMinerSignal
                ? <span className="inline-flex items-center gap-2">
                    <span
                      className="relative size-3 rounded-sm border border-primary bg-primary/20 ring-1 ring-primary/60"
                      ariaHidden=true
                    >
                      <Ui.Sparkles className="absolute -right-1 -top-1 size-2.5 text-primary" />
                    </span>
                    {text("Miner's first-ever signal")}
                  </span>
                : React.null}
            </React.Fragment>
          : React.null}
      </div>
    </Ui.CardHeader>
    <Ui.CardContent>
      <div
        className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]"
      >
        {visibleBlocks
        ->Array.map((block: Monitor.monitorGridBlockWire) =>
          <Tile key={block.height->Int.toString} attributionForHash block mode onAttributionOpen />
        )
        ->React.array}
      </div>
      {hiddenCount > 0
        ? <Ui.Button
            variant="outline"
            size="sm"
            onClick={onShowAllBlocks}
            className={ursfClass(
              mode,
              "mt-4 w-full bg-background",
              "ursf-link-button border-[var(--ursf-border)] bg-[var(--ursf-card)]",
            )}
          >
            {text(
              `Show all ${MonitorDashboardModel.formatNumber(gridBlocks->Array.length)} blocks`,
            )}
          </Ui.Button>
        : React.null}
      {liveBlockCount === 0
        ? <p className={ursfClass(mode, "mt-3 text-xs text-muted-foreground", "ursf-muted")}>
            {text("Waiting for detailed block metadata.")}
          </p>
        : React.null}
    </Ui.CardContent>
  </Ui.Card>
}

let loadingCard = mode =>
  <Ui.Card
    className={ursfClass(
      mode,
      "border-border/50 bg-card/50 backdrop-blur",
      "ursf-card mt-6 border",
    )}
  >
    <Ui.CardContent className="flex min-h-40 items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span ariaHidden=true>
          <Ui.RefreshCw className="size-4 animate-spin" />
        </span>
        {text("Loading block grid")}
      </div>
    </Ui.CardContent>
  </Ui.Card>

let unavailableCard = (mode, error) =>
  <Ui.Card className={ursfClass(mode, "border-destructive/30 bg-destructive/5", "mt-6")}>
    <Ui.CardContent className="flex items-start gap-3 pt-6">
      <span ariaHidden=true>
        <Ui.AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
      </span>
      <p className="text-sm text-muted-foreground">
        {text(error->Option.getOr("Block grid data could not be loaded."))}
      </p>
    </Ui.CardContent>
  </Ui.Card>

@react.component
let make = (
  ~attributionForHash,
  ~blockDataStatus,
  ~blocks,
  ~data,
  ~error,
  ~loading,
  ~mode="bip110",
  ~onAttributionOpen,
  ~onShowAllBlocks,
  ~showAllBlocks,
) =>
  switch data->Nullable.toOption {
  | None if loading => loadingCard(mode)
  | None => unavailableCard(mode, error->Nullable.toOption)
  | Some(data) =>
    <div className={mode === "ursf" ? "mt-6" : ""}>
      {grid(
        ~attributionForHash,
        ~blockDataStatus,
        ~blocks,
        ~data,
        ~mode,
        ~onAttributionOpen,
        ~onShowAllBlocks,
        ~showAllBlocks,
      )}
    </div>
  }
