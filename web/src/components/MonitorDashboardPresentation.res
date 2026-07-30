module PackageView = {
  module Chart = {
    @module("./MonitorPeriodChartView") @react.component
    external make: (
      ~currentPeriodNum: int,
      ~metric: MonitorDashboardModel.periodChartMetric,
      ~onMetricChange: MonitorDashboardModel.periodChartMetric => unit,
      ~periods: array<Monitor.monitorPeriod>,
    ) => React.element = "MonitorPeriodChartView"
  }
}

let monitorUrl = "https://bip110monitor.com"
let ursfMonitorUrl = "/ursf-monitor"
let mempoolBlockUrl = "https://mempool.guide/block"
let voluntaryDeadlineBlock = 961542
let voluntaryDeadlinePeriod = 476
let signalBit = 4
let currentPeriodSectionId = "current-period"
let rulesSectionId = "rules"
let historySectionId = "difficulty-adjustment-period-history"

let text = React.string
let number = value => value->MonitorDashboardModel.formatNumber->text

let widthStyle = percent =>
  ReactDOM.Style._dictToStyle(
    dict{
      "width": `${MonitorDashboardModel.clampPercent(percent)->Float.toString}%`,
    },
  )

module StatusCard = {
  @react.component
  let make = (~label, ~value, ~detail, ~primary=false) =>
    <Ui.Card
      className={primary
        ? "border-border/50 bg-card/50 backdrop-blur border-primary/25 bg-primary/5"
        : "border-border/50 bg-card/50 backdrop-blur"}
    >
      <Ui.CardContent className="pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {text(label)}
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight"> {text(value)} </p>
        <p className="mt-1 text-sm text-muted-foreground"> {text(detail)} </p>
      </Ui.CardContent>
    </Ui.Card>
}

module SectionTitleLink = {
  @react.component
  let make = (~id, ~className="", ~children) =>
    <a
      href={`#${id}`}
      className={`inline-flex w-fit rounded-sm text-current transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      {children}
    </a>
}

module PeriodBlockLink = {
  @react.component
  let make = (~block, ~children) =>
    <a
      href={`${mempoolBlockUrl}/${block->Int.toString}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {children}
      <span ariaHidden=true>
        <Ui.ExternalLink className="size-3" />
      </span>
    </a>
}

module ProgressRow = {
  @react.component
  let make = (~label, ~value, ~detail, ~percent, ~className="") =>
    <div className="space-y-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium"> {text(label)} </p>
          <p className="text-xs text-muted-foreground"> {text(detail)} </p>
        </div>
        <p className="font-mono text-sm text-muted-foreground"> {text(value)} </p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full bg-primary transition-[width] duration-500 ${className}`}
          style={widthStyle(percent)}
        />
      </div>
    </div>
}

module MandatorySignalingCards = {
  @react.component
  let make = (~data, ~now) => {
    let model = MonitorDashboardModel.mandatorySignalingModel(data, now)
    let expectedAt = model.expectedAt->Nullable.toOption
    let countdownLabel =
      model.units
      ->Array.map(unit => `${unit.value->Int.toString} ${unit.label->String.toLowerCase}`)
      ->Array.join(", ")

    <section className="grid gap-4 lg:grid-cols-2" ariaLabel="Mandatory signaling schedule">
      <Ui.Card className="min-h-80 border-primary/35 bg-card/70 py-0 ring-primary/10">
        <Ui.CardContent className="flex h-full flex-col p-6 sm:p-8">
          <h2 className="max-w-md text-base font-bold uppercase tracking-[0.08em] sm:text-xl">
            {text("Mandatory signaling begins in")}
          </h2>
          <div className="my-8 grid grid-cols-2 gap-3 sm:my-10" ariaLabel={countdownLabel}>
            {model.units
            ->Array.map(unit =>
              <div
                key={unit.label}
                className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-primary/25 bg-primary/[0.035] px-3 py-4"
              >
                <span
                  className="font-mono text-4xl font-bold tracking-tight text-primary sm:text-5xl"
                >
                  {text(unit.displayValue)}
                </span>
                <span
                  className="mt-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
                >
                  {text(unit.label)}
                </span>
              </div>
            )
            ->React.array}
          </div>
          <div className="mt-auto space-y-1 text-sm sm:text-base">
            <p className="font-medium text-foreground/80">
              {text("Estimated start: ")}
              {switch expectedAt {
              | None => text("Unknown")
              | Some(expectedAt) =>
                <time dateTime={expectedAt->Date.fromTime->Date.toISOString}>
                  {text(MonitorDashboardModel.formatDateTime(expectedAt))}
                </time>
              }}
            </p>
          </div>
        </Ui.CardContent>
      </Ui.Card>
      <Ui.Card className="min-h-80 border-primary/35 bg-card/70 py-0 ring-primary/10">
        <Ui.CardContent className="flex h-full flex-col p-6 sm:p-8">
          <h2 className="max-w-md text-base font-bold uppercase tracking-[0.08em] sm:text-xl">
            {text("Blocks to mandatory phase")}
          </h2>
          <p
            className="my-auto py-10 font-mono text-6xl font-bold tracking-tight text-primary sm:text-7xl xl:text-8xl"
          >
            {number(model.blocksRemaining)}
          </p>
          <p className="mt-auto text-sm text-muted-foreground sm:text-base">
            {text(`until #${model.target}`)}
          </p>
        </Ui.CardContent>
      </Ui.Card>
    </section>
  }
}

let unavailable = error =>
  <Ui.Card className="border-destructive/30 bg-destructive/5">
    <Ui.CardContent className="space-y-4 pt-6">
      <div className="flex items-start gap-3">
        <span ariaHidden=true>
          <Ui.AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
        </span>
        <div>
          <h2 className="font-semibold"> {text("Monitor data unavailable")} </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {text(error->Option.getOr("The public monitor API did not return data."))}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <a
          href={monitorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {text("Open source monitor")}
          <span ariaHidden=true>
            <Ui.ExternalLink className="size-4" />
          </span>
        </a>
        <a
          href={ursfMonitorUrl}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {text("URSF Monitor")}
          <span ariaHidden=true>
            <Ui.ExternalLink className="size-4" />
          </span>
        </a>
      </div>
    </Ui.CardContent>
  </Ui.Card>

let loadingCard =
  <Ui.Card className="border-border/50 bg-card/50 backdrop-blur">
    <Ui.CardContent className="flex min-h-80 items-center justify-center">
      <div className="flex items-center gap-3 text-muted-foreground">
        <span ariaHidden=true>
          <Ui.RefreshCw className="size-5 animate-spin" />
        </span>
        {text("Loading live monitor data")}
      </div>
    </Ui.CardContent>
  </Ui.Card>

let historyTable = (data: Monitor.monitorData, stats: MonitorDashboardModel.dashboardStats) =>
  <div className="overflow-x-auto">
    <table className="w-full min-w-160 text-left text-sm">
      <thead
        className="border-b border-border/50 text-xs uppercase tracking-wide text-muted-foreground"
      >
        <tr>
          <th className="py-3 pl-4 pr-4 font-medium"> {text("Period")} </th>
          <th className="py-3 pr-4 font-medium"> {text("First block")} </th>
          <th className="py-3 pr-4 font-medium"> {text("Last block")} </th>
          <th className="py-3 pr-4 font-medium"> {text("Blocks tracked")} </th>
          <th className="py-3 pr-4 font-medium"> {text("Signaling")} </th>
          <th className="py-3 font-medium"> {text("Signal %")} </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {stats.historyPeriods
        ->Array.map(period => {
          let isCurrent = period.periodNum === data.periodNum

          <tr key={period.periodNum->Int.toString} className={isCurrent ? "bg-primary/5" : ""}>
            <td className="py-3 pl-4 pr-4 font-medium">
              <div className="flex flex-wrap items-center gap-2">
                <span> {text(period.periodNum->Int.toString)} </span>
                {isCurrent
                  ? <span
                      className="inline-flex h-5 items-center rounded-full border border-primary/25 bg-primary/10 px-2 text-[0.7rem] font-medium leading-none text-primary"
                    >
                      {text("Current")}
                    </span>
                  : React.null}
              </div>
            </td>
            <td className="py-3 pr-4">
              <PeriodBlockLink block={period.startBlock}>
                {number(period.startBlock)}
              </PeriodBlockLink>
            </td>
            <td className="py-3 pr-4">
              <PeriodBlockLink block={period.endBlock}> {number(period.endBlock)} </PeriodBlockLink>
            </td>
            <td className="py-3 pr-4 text-muted-foreground">
              {text(
                `${MonitorDashboardModel.formatNumber(
                    period.totalBlocks,
                  )} / ${MonitorDashboardModel.formatNumber(
                    MonitorDashboardModel.periodBlockCount,
                  )}`,
              )}
            </td>
            <td className="py-3 pr-4 text-muted-foreground"> {number(period.signalingCount)} </td>
            <td className="py-3 font-mono text-muted-foreground">
              {text(MonitorDashboardModel.formatPercent(period.pct))}
            </td>
          </tr>
        })
        ->React.array}
      </tbody>
    </table>
  </div>

let loadedDashboard = (
  ~attributionForHash,
  ~blockDataStatus,
  ~blocks,
  ~cacheInfo,
  ~chartMetric,
  ~data,
  ~error,
  ~now,
  ~onAttributionOpen,
  ~onChartMetricChange,
  ~onRefresh,
  ~onRecentWindowChange,
  ~onShowAllBlocks,
  ~recentWindow,
  ~refreshing,
  ~showAllBlocks,
) => {
  let stats = MonitorDashboardModel.dashboardStats(data)
  let lagStatus = MonitorDashboardModel.monitorLagStatus(data)->Nullable.toOption
  let cacheInfo = cacheInfo->Nullable.toOption

  <div className="space-y-6" dataTestId="monitor-react">
    <div
      className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 shadow-sm shadow-foreground/5 dark:bg-card/60"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {switch lagStatus {
            | Some(status) =>
              <Ui.Badge
                variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 text-primary"
              >
                <span className="size-1.5 rounded-full bg-current animate-pulse" ariaHidden=true />
                {text(status)}
              </Ui.Badge>
            | None => React.null
            }}
            <span className="text-sm text-foreground/80">
              {text(`Updated ${MonitorDashboardModel.formatUpdatedAt(data.updatedAt)}`)}
            </span>
            {switch cacheInfo {
            | Some(cacheInfo: MonitorDataController.cacheInfo) =>
              <span className="text-sm text-muted-foreground">
                {text(
                  `Cached ${MonitorDashboardModel.formatCacheAge(cacheInfo.cachedAt, Date.now())}`,
                )}
              </span>
            | None => React.null
            }}
          </div>
          <div
            className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center"
          >
            <span> {text(`Public BIP-${data.bip} monitor data is cached locally.`)} </span>
            <span
              className="hidden size-1 rounded-full bg-muted-foreground/40 sm:block" ariaHidden=true
            />
            <a
              href={monitorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1 text-primary hover:underline"
            >
              {text("Source monitor")}
              <span ariaHidden=true>
                <Ui.ExternalLink className="size-3" />
              </span>
            </a>
            <a
              href={ursfMonitorUrl}
              className="inline-flex w-fit items-center gap-1 text-primary hover:underline"
            >
              {text("URSF Monitor")}
            </a>
          </div>
        </div>
        <Ui.Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          className="self-start bg-background md:self-auto"
          disabled={refreshing}
        >
          <span ariaHidden=true>
            <Ui.RefreshCw className={refreshing ? "size-3.5 animate-spin" : "size-3.5"} />
          </span>
          {text("Refresh")}
        </Ui.Button>
      </div>
    </div>

    {switch error->Nullable.toOption {
    | Some(error) =>
      <div
        className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
      >
        <span ariaHidden=true>
          <Ui.AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
        </span>
        <p className="text-muted-foreground">
          {text(
            `Last refresh failed: ${error}. Showing ${switch cacheInfo {
              | Some({source: #cache}) => "cached"
              | _ => "latest loaded"
              }} values.`,
          )}
        </p>
      </div>
    | None => React.null
    }}

    <div className="grid gap-4 md:grid-cols-3">
      <StatusCard
        label="Chain tip"
        value={MonitorDashboardModel.formatNumber(data.chainTip)}
        detail={MonitorDashboardModel.chainTipDetail(data)}
      />
      <StatusCard
        label="Signal rate"
        value={MonitorDashboardModel.formatPercent(data.pct)}
        detail={`Current period target is ${MonitorDashboardModel.activationThreshold->Int.toString}%`}
        primary=true
      />
      <StatusCard
        label="Signals"
        value={MonitorDashboardModel.formatNumber(data.signalingCount)}
        detail={`${MonitorDashboardModel.formatNumber(
            data.totalBlocks,
          )} blocks tracked this period`}
      />
    </div>

    {MandatorySignaling.shouldShowMandatorySignaling(data.tip)
      ? <MandatorySignalingCards data now />
      : React.null}

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <Ui.Card
        id=currentPeriodSectionId className="scroll-mt-24 border-border/50 bg-card/50 backdrop-blur"
      >
        <Ui.CardHeader>
          <Ui.CardTitle>
            <SectionTitleLink id=currentPeriodSectionId>
              {text(`Difficulty Adjustment Period ${data.periodNum->Int.toString}`)}
            </SectionTitleLink>
          </Ui.CardTitle>
        </Ui.CardHeader>
        <Ui.CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {text("Block range")}
              </p>
              <p className="mt-2 text-sm font-medium">
                <PeriodBlockLink block={data.periodStart}>
                  {number(data.periodStart)}
                </PeriodBlockLink>
                <span className="mx-2 text-muted-foreground"> {text("to")} </span>
                <PeriodBlockLink block={data.periodEnd}> {number(data.periodEnd)} </PeriodBlockLink>
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {text("Blocks left")}
              </p>
              <p className="mt-2 text-lg font-semibold"> {number(stats.blocksLeft)} </p>
              <p className="text-sm text-muted-foreground">
                {text(MonitorDashboardModel.formatEstimatedTime(stats.blocksLeft))}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {text("Threshold")}
              </p>
              <p className="mt-2 text-lg font-semibold">
                {number(MonitorDashboardModel.requiredSignalingBlocks)}
              </p>
              <p className="text-sm text-muted-foreground"> {text("signaling blocks required")} </p>
            </div>
          </div>
          <div className="space-y-5">
            <ProgressRow
              label="Signaling rate"
              value={MonitorDashboardModel.formatPercent(data.pct)}
              detail={`${MonitorDashboardModel.formatNumber(
                  data.signalingCount,
                )} signaling blocks, ${MonitorDashboardModel.formatNumber(
                  stats.signalingDeficit,
                )} more needed for lock-in`}
              percent={stats.activationProgress}
            />
            <ProgressRow
              label="Period progress"
              value={`${MonitorDashboardModel.formatNumber(
                  data.totalBlocks,
                )} / ${MonitorDashboardModel.formatNumber(MonitorDashboardModel.periodBlockCount)}`}
              detail={`${MonitorDashboardModel.formatNumber(
                  stats.blocksLeft,
                )} blocks remain in this period`}
              percent={stats.periodProgress}
              className="bg-foreground/70 dark:bg-foreground/80"
            />
          </div>
        </Ui.CardContent>
      </Ui.Card>

      <Ui.Card id=rulesSectionId className="scroll-mt-24 border-border/50 bg-card/50 backdrop-blur">
        <Ui.CardHeader>
          <Ui.CardTitle>
            <SectionTitleLink id=rulesSectionId> {text("BIP-110 Rules")} </SectionTitleLink>
          </Ui.CardTitle>
        </Ui.CardHeader>
        <Ui.CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            {text(
              "BIP-110 is a temporary soft fork that limits data field sizes to reduce blockchain bloat and refocus development on monetary use cases.",
            )}
          </p>
          <div className="grid gap-3">
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium text-foreground"> {text("Signal bit")} </p>
              <p> {text(`Miners signal support by setting bit ${signalBit->Int.toString}.`)} </p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium text-foreground"> {text("Activation")} </p>
              <p>
                {text(
                  `${MonitorDashboardModel.activationThreshold->Int.toString}% of blocks in one 2,016-block period must signal for early lock-in.`,
                )}
              </p>
            </div>
            <div className="rounded-lg border border-border/50 p-3">
              <p className="font-medium text-foreground"> {text("Voluntary deadline")} </p>
              <p>
                {text(
                  `Block ${MonitorDashboardModel.formatNumber(
                      voluntaryDeadlineBlock,
                    )} in period ${voluntaryDeadlinePeriod->Int.toString}.`,
                )}
              </p>
            </div>
          </div>
        </Ui.CardContent>
      </Ui.Card>
    </div>

    <Ui.Card id=historySectionId className="scroll-mt-24 border-border/50 bg-card/50 backdrop-blur">
      <Ui.CardHeader>
        <Ui.CardTitle>
          <SectionTitleLink id=historySectionId>
            {text("Difficulty Adjustment Period History")}
          </SectionTitleLink>
        </Ui.CardTitle>
      </Ui.CardHeader>
      <Ui.CardContent className="space-y-6">
        <PackageView.Chart
          currentPeriodNum={data.periodNum}
          metric={chartMetric}
          onMetricChange={onChartMetricChange}
          periods={stats.historyPeriods}
        />
        {historyTable(data, stats)}
      </Ui.CardContent>
    </Ui.Card>

    <MonitorRecentSignalingPresentation
      blockDataStatus
      blocks
      cacheInfo={cacheInfo->Nullable.fromOption}
      data
      onWindowChange={onRecentWindowChange}
      windowSize={recentWindow}
    />
    <MonitorBlockGridPresentation
      attributionForHash
      blockDataStatus
      blocks
      data={Nullable.make(data)}
      error={Nullable.null}
      loading=false
      onAttributionOpen
      onShowAllBlocks
      showAllBlocks
    />
  </div>
}

@react.component
let make = (
  ~attributionForHash,
  ~blockDataStatus,
  ~blocks,
  ~cacheInfo,
  ~chartMetric,
  ~data,
  ~error,
  ~loading,
  ~now,
  ~onAttributionOpen,
  ~onChartMetricChange,
  ~onRefresh,
  ~onRecentWindowChange,
  ~onShowAllBlocks,
  ~recentWindow,
  ~refreshing,
  ~showAllBlocks,
) =>
  switch data->Nullable.toOption {
  | None if loading => loadingCard
  | None => unavailable(error->Nullable.toOption)
  | Some(data) =>
    loadedDashboard(
      ~attributionForHash,
      ~blockDataStatus,
      ~blocks,
      ~cacheInfo,
      ~chartMetric,
      ~data,
      ~error,
      ~now,
      ~onAttributionOpen,
      ~onChartMetricChange,
      ~onRefresh,
      ~onRecentWindowChange,
      ~onShowAllBlocks,
      ~recentWindow,
      ~refreshing,
      ~showAllBlocks,
    )
  }
