@genType
type metadataText = {
  title: string,
  description: string,
  imageAlt: string,
}

type chartPoint = {
  period: Monitor.monitorPeriod,
  x: float,
  y: float,
}

let dateTimeFormatter = Intl.DateTimeFormat.make(
  ~locales=["en-US"],
  ~options={
    day: #numeric,
    hour: #numeric,
    minute: #"2-digit",
    month: #short,
    timeZoneName: #short,
    year: #numeric,
  },
)
let chartPercentFormatter = Intl.NumberFormat.make(
  ~locales=["en-US"],
  ~options={maximumFractionDigits: #2},
)

let maxInt = (left, right) => left > right ? left : right
let clampPercent = value => Math.min(Math.max(value, 0.0), 100.0)

let formatCountdownUnit = value => value->Int.toString->String.padStart(2, "0")

let formatBlockCount = value =>
  `${MonitorPresentation.formatInteger(value)} ${value === 1 ? "block" : "blocks"}`

let formatEstimatedTime = blocks => {
  let minutes = blocks * 10
  let days = minutes->Int.toFloat /. 1440.0

  if days >= 2.0 {
    `~${days->Float.toFixed(~digits=days >= 10.0 ? 0 : 1)} days`
  } else {
    let hours = minutes->Int.toFloat /. 60.0

    if hours >= 1.0 {
      `~${hours->Float.toFixed(~digits=hours >= 10.0 ? 0 : 1)} hours`
    } else {
      `~${minutes->Int.toString} minutes`
    }
  }
}

let formatDate = date =>
  date->Date.getTime->Float.isNaN ? "Unknown" : dateTimeFormatter->Intl.DateTimeFormat.format(date)

let formatDateTime = value => value->Date.fromTime->formatDate
let formatUpdatedAt = value => value->Date.fromString->formatDate

let elapsedSecondsSince = (value, now) => {
  let timestamp = value->Date.fromString->Date.getTime
  timestamp->Float.isNaN ? 0 : maxInt(Math.Int.floor((now -. timestamp) /. 1000.0), 0)
}

@genType
let monitorSyncStatus = (data: Monitor.monitorData) => {
  let lagBlocks = maxInt(data.chainTip - data.tip, 0)

  if data.synced && lagBlocks === 0 {
    ""
  } else if lagBlocks === 0 {
    "Monitor index catching up"
  } else {
    `Monitor lagging by ${formatBlockCount(lagBlocks)}`
  }
}

@genType
let activationProgressPercent = (data: Monitor.monitorData) =>
  clampPercent(data.pct /. MonitorPresentation.activationThreshold->Int.toFloat *. 100.0)

@genType
let periodProgressPercent = (data: Monitor.monitorData) =>
  clampPercent(data.totalBlocks->Int.toFloat /. Monitor.periodSize->Int.toFloat *. 100.0)

let previousPeriod = (data: Monitor.monitorData) =>
  data.periods
  ->Array.toSorted((left, right) => Int.compare(right.periodNum, left.periodNum))
  ->Array.find(period => period.periodNum < data.periodNum)

let periodValue = (period, fallback, select) => {
  switch period {
  | Some(period) => select(period)
  | None => fallback
  }
}

let escapeHtml = value =>
  value
  ->String.replaceAll("&", "&amp;")
  ->String.replaceAll("\"", "&quot;")
  ->String.replaceAll("<", "&lt;")
  ->String.replaceAll(">", "&gt;")

let formatSignalingBlockCount = value =>
  `${MonitorPresentation.formatInteger(value)} signaling ${value === 1 ? "block" : "blocks"}`

let formatChartPercent = value => `${chartPercentFormatter->Intl.NumberFormat.format(value)}%`

let chartPeriodsFor = (data: Monitor.monitorData) => {
  let currentPeriod: Monitor.monitorPeriod = {
    periodNum: data.periodNum,
    startBlock: data.periodStart,
    endBlock: data.periodEnd,
    signalingCount: data.signalingCount,
    totalBlocks: data.totalBlocks,
    pct: data.pct,
  }
  let previousPeriods =
    data.periods
    ->Array.filter(period => period.periodNum !== data.periodNum)
    ->Array.toSorted((left, right) => Int.compare(left.periodNum, right.periodNum))

  Array.concat(previousPeriods, [currentPeriod])
}

let periodChartY = (value, maxValue, top, height) => top +. height -. value /. maxValue *. height

let periodChartX = (index, pointCount, left, width) =>
  pointCount === 1
    ? left +. width /. 2.0
    : left +. width /. (pointCount - 1)->Int.toFloat *. index->Int.toFloat

@genType
let periodSignalingChartHtml = (data: Monitor.monitorData) => {
  let periods = chartPeriodsFor(data)

  if periods->Array.length === 0 {
    [
      "<div class=\"rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground\">",
      "No period history available for charting.",
      "</div>",
    ]->Array.join("")
  } else {
    let chartWidth = maxInt(640, periods->Array.length * 76 + 88)
    let chartHeight = 288
    let marginBottom = 58.0
    let marginLeft = 64.0
    let marginRight = 24.0
    let marginTop = 28.0
    let plotHeight = chartHeight->Int.toFloat -. marginTop -. marginBottom
    let plotWidth = chartWidth->Int.toFloat -. marginLeft -. marginRight
    let highestPercent =
      periods->Array.reduce(0.0, (highest, period) => Math.max(highest, period.pct))
    let maxValue = Math.min(
      Math.max(Math.ceil(highestPercent *. 1.1 *. 100.0) /. 100.0, 1.0),
      100.0,
    )
    let midValue = Math.round(maxValue /. 2.0 *. 100.0) /. 100.0
    let yTicks = [maxValue, midValue, 0.0]->Array.reduce([], (ticks, tick) => {
      if !(ticks->Array.some(existing => existing === tick)) {
        ticks->Array.push(tick)->ignore
      }
      ticks
    })
    let points: array<chartPoint> = periods->Array.mapWithIndex((period, index) => {
      period,
      x: periodChartX(index, periods->Array.length, marginLeft, plotWidth),
      y: periodChartY(period.pct, maxValue, marginTop, plotHeight),
    })
    let linePath =
      points
      ->Array.mapWithIndex((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x->Float.toString} ${point.y->Float.toString}`
      )
      ->Array.join(" ")
    let yTickHtml =
      yTicks
      ->Array.map(tick => {
        let y = periodChartY(tick, maxValue, marginTop, plotHeight)
        [
          "<g>",
          `<line x1="${marginLeft->Float.toString}" x2="${(chartWidth->Int.toFloat -. marginRight)
              ->Float.toString}" y1="${y->Float.toString}" y2="${y->Float.toString}" stroke="currentColor" stroke-opacity="0.16" />`,
          `<text x="${(marginLeft -. 12.0)->Float.toString}" y="${(y +. 4.0)
              ->Float.toString}" text-anchor="end" class="fill-current font-mono text-[11px]">${formatChartPercent(
              tick,
            )}</text>`,
          "</g>",
        ]->Array.join("")
      })
      ->Array.join("")
    let pointHtml =
      points
      ->Array.map(point => {
        let period = point.period
        let x = point.x
        let y = point.y
        let isCurrentPeriod = period.periodNum === data.periodNum
        let tooltipAbove = y > marginTop +. 42.0
        let tooltipY = tooltipAbove ? y -. 40.0 : y +. 14.0
        let tooltipTextY = tooltipAbove ? y -. 23.0 : y +. 31.0
        let currentLabel = isCurrentPeriod
          ? `<text x="${x->Float.toString}" y="${(chartHeight - 14)
                ->Int.toString}" text-anchor="middle" class="fill-primary text-[10px] font-medium">current</text>`
          : ""
        let title =
          [
            `Period ${period.periodNum->Int.toString}: ${MonitorPresentation.formatPercent(
                period.pct,
              )}`,
            `(${formatSignalingBlockCount(period.signalingCount)})`,
          ]
          ->Array.join(" ")
          ->escapeHtml
        let ariaLabel =
          `Period ${period.periodNum->Int.toString}: ${MonitorPresentation.formatPercent(
              period.pct,
            )}, ${formatSignalingBlockCount(period.signalingCount)}`->escapeHtml

        [
          `<g aria-label="${ariaLabel}" class="period-chart-point outline-none" role="img" tabindex="0">`,
          `<title>${title}</title>`,
          `<circle cx="${x->Float.toString}" cy="${y->Float.toString}" r="${isCurrentPeriod
              ? "5.5"
              : "4.5"}" class="transition-[r,fill] duration-150" fill="var(--primary)" stroke="var(--background)" stroke-width="3" />`,
          "<g class=\"period-chart-tooltip\">",
          `<rect x="${(x -. 34.0)
              ->Float.toString}" y="${tooltipY->Float.toString}" width="68" height="24" rx="6" class="fill-popover stroke-border" />`,
          `<text x="${x->Float.toString}" y="${tooltipTextY->Float.toString}" text-anchor="middle" class="fill-popover-foreground font-mono text-[11px]">${MonitorPresentation.formatPercent(
              period.pct,
            )}</text>`,
          "</g>",
          `<text x="${x->Float.toString}" y="${Math.max(
              y -. 12.0,
              14.0,
            )->Float.toString}" text-anchor="middle" class="fill-current font-mono text-[11px]">${MonitorPresentation.formatPercent(
              period.pct,
            )}</text>`,
          `<text x="${x->Float.toString}" y="${(chartHeight - 31)
              ->Int.toString}" text-anchor="middle" class="fill-current font-mono text-[11px]">${period.periodNum->Int.toString}</text>`,
          currentLabel,
          "</g>",
        ]->Array.join("")
      })
      ->Array.join("")

    [
      "<div class=\"flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between\">",
      "<div>",
      "<h3 class=\"text-base font-semibold tracking-tight\">Signaling % by period</h3>",
      "<p class=\"mt-1 text-sm text-muted-foreground\">The line charts the signaling rate from the period history table.</p>",
      "</div>",
      "<div class=\"flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground\">",
      "<span class=\"inline-flex items-center gap-2\"><span class=\"size-3 rounded-full border-2 border-primary bg-background\" aria-hidden=\"true\"></span>Signaling %</span>",
      "</div>",
      "</div>",
      `<div class="mt-5 overflow-x-auto" role="img" aria-label="Signaling percentage by difficulty adjustment period. Chart maximum is ${formatChartPercent(
          maxValue,
        )}.">`,
      "<div class=\"w-max\">",
      `<svg class="max-w-none text-muted-foreground" width="${chartWidth->Int.toString}" height="${chartHeight->Int.toString}" viewBox="0 0 ${chartWidth->Int.toString} ${chartHeight->Int.toString}">`,
      yTickHtml,
      `<line x1="${marginLeft->Float.toString}" x2="${marginLeft->Float.toString}" y1="${marginTop->Float.toString}" y2="${(marginTop +.
        plotHeight)->Float.toString}" stroke="currentColor" stroke-opacity="0.28" />`,
      `<line x1="${marginLeft->Float.toString}" x2="${(chartWidth->Int.toFloat -. marginRight)
          ->Float.toString}" y1="${(marginTop +. plotHeight)->Float.toString}" y2="${(marginTop +.
        plotHeight)->Float.toString}" stroke="currentColor" stroke-opacity="0.28" />`,
      `<path d="${linePath}" fill="none" stroke="var(--primary)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" />`,
      pointHtml,
      "</svg>",
      "<p class=\"text-center text-[11px] text-muted-foreground\">difficulty adjustment period</p>",
      "</div>",
      "</div>",
    ]->Array.join("")
  }
}

@genType
let monitorPageFields = (
  data: Monitor.monitorData,
  blocks: array<Monitor.monitorBlockWire>,
  recentWindow: RecentSignaling.window,
  now,
) => {
  let recent = RecentSignaling.recentSignaling(
    blocks->Array.map((block): RecentSignaling.signalingBlock => {
      height: block.height,
      signaling: block.signaling,
    }),
    recentWindow,
  )
  let blocksLeft = maxInt(data.periodEnd - data.tip, 0)
  let requiredSignalBlocks = Math.Int.ceil(
    Monitor.periodSize->Int.toFloat *.
      (MonitorPresentation.activationThreshold->Int.toFloat /.
      100.0),
  )
  let signalingDeficit = maxInt(requiredSignalBlocks - data.signalingCount, 0)
  let previous = previousPeriod(data)
  let mandatoryEstimate = MandatorySignaling.mandatorySignalingEstimate(
    data.tip,
    ~elapsedSeconds=elapsedSecondsSince(data.updatedAt, now),
  )
  let observedAt = data.updatedAt->Date.fromString->Date.getTime
  let mandatoryExpectedAt =
    MandatorySignaling.mandatorySignalingExpectedAt(data.tip, observedAt)
    ->Nullable.toOption
    ->Option.map(formatDateTime)
    ->Option.getOr("Unknown")
  let fieldEntries = [
    ("blocks-left", MonitorPresentation.formatInteger(blocksLeft)),
    ("blocks-left-detail", formatEstimatedTime(blocksLeft)),
    ("chain-tip", MonitorPresentation.formatInteger(data.chainTip)),
    ("history-current-end", MonitorPresentation.formatInteger(data.periodEnd)),
    ("history-current-percent", MonitorPresentation.formatPercent(data.pct)),
    ("history-current-period", MonitorPresentation.formatInteger(data.periodNum)),
    ("history-current-signaling", MonitorPresentation.formatInteger(data.signalingCount)),
    ("history-current-start", MonitorPresentation.formatInteger(data.periodStart)),
    (
      "history-current-tracked",
      `${MonitorPresentation.formatInteger(data.totalBlocks)} / ${MonitorPresentation.formatInteger(
          Monitor.periodSize,
        )}`,
    ),
    (
      "history-previous-end",
      previous->periodValue(MonitorPresentation.formatInteger(data.periodStart - 1), period =>
        MonitorPresentation.formatInteger(period.endBlock)
      ),
    ),
    (
      "history-previous-percent",
      previous->periodValue("0.00%", period => MonitorPresentation.formatPercent(period.pct)),
    ),
    (
      "history-previous-period",
      previous->periodValue("previous", period =>
        MonitorPresentation.formatInteger(period.periodNum)
      ),
    ),
    (
      "history-previous-signaling",
      previous->periodValue("0", period =>
        MonitorPresentation.formatInteger(period.signalingCount)
      ),
    ),
    (
      "history-previous-start",
      previous->periodValue(
        MonitorPresentation.formatInteger(data.periodStart - Monitor.periodSize),
        period => MonitorPresentation.formatInteger(period.startBlock),
      ),
    ),
    (
      "history-previous-tracked",
      `${previous
        ->periodValue(Monitor.periodSize, period => period.totalBlocks)
        ->MonitorPresentation.formatInteger} / ${MonitorPresentation.formatInteger(
          Monitor.periodSize,
        )}`,
    ),
    ("indexed-tip", MonitorPresentation.formatInteger(data.tip)),
    ("mandatory-blocks", MonitorPresentation.formatInteger(mandatoryEstimate.blocksRemaining)),
    (
      "mandatory-countdown-heading",
      mandatoryEstimate.status === #pending
        ? "Mandatory signaling begins in"
        : "Mandatory signaling height reached",
    ),
    ("mandatory-days", formatCountdownUnit(mandatoryEstimate.countdown.days)),
    ("mandatory-expected-at", mandatoryExpectedAt),
    ("mandatory-hours", formatCountdownUnit(mandatoryEstimate.countdown.hours)),
    ("mandatory-minutes", formatCountdownUnit(mandatoryEstimate.countdown.minutes)),
    ("mandatory-seconds", formatCountdownUnit(mandatoryEstimate.countdown.seconds)),
    (
      "mandatory-target",
      MonitorPresentation.formatInteger(MandatorySignaling.mandatorySignalingHeight),
    ),
    ("mandatory-tip", MonitorPresentation.formatInteger(data.tip)),
    (
      "period-detail",
      `${MonitorPresentation.formatInteger(blocksLeft)} blocks remain in this period`,
    ),
    ("period-end", MonitorPresentation.formatInteger(data.periodEnd)),
    ("period-num", MonitorPresentation.formatInteger(data.periodNum)),
    (
      "period-progress",
      `${MonitorPresentation.formatInteger(data.totalBlocks)} / ${MonitorPresentation.formatInteger(
          Monitor.periodSize,
        )}`,
    ),
    ("period-start", MonitorPresentation.formatInteger(data.periodStart)),
    ("recent-signaling-counts", RecentSignaling.recentSignalingCounts(recent)),
    ("recent-signaling-detail", RecentSignaling.recentSignalingDetail(recent, data.periodNum)),
    ("recent-signaling-heading", RecentSignaling.recentWindowHeading(recent.window)),
    (
      "recent-signaling-pct",
      recent.sampled === 0 ? "N/A" : MonitorPresentation.formatPercent(recent.pct),
    ),
    ("signal-rate", MonitorPresentation.formatPercent(data.pct)),
    (
      "signaling-detail",
      `${MonitorPresentation.formatInteger(
          data.signalingCount,
        )} signaling blocks, ${MonitorPresentation.formatInteger(
          signalingDeficit,
        )} more needed for lock-in`,
    ),
    ("signals", MonitorPresentation.formatInteger(data.signalingCount)),
    ("sync-status", monitorSyncStatus(data)),
    ("threshold", MonitorPresentation.formatInteger(requiredSignalBlocks)),
    ("updated-at", formatUpdatedAt(data.updatedAt)),
  ]

  Dict.fromArray(fieldEntries)
}

@genType
let monitorMetadataText = (data: Monitor.monitorData): metadataText => {
  let pct = MonitorPresentation.formatPercent(data.pct)
  {
    title: `BIP-110 Monitor: ${pct} signaling`,
    description: MonitorPresentation.monitorDescription(data),
    imageAlt: [
      `BIP-110 signaling status: ${pct}`,
      `${MonitorPresentation.formatInteger(
          data.signalingCount,
        )} of ${MonitorPresentation.formatInteger(data.totalBlocks)} blocks`,
      `in period ${data.periodNum->MonitorPresentation.formatInteger}`,
      `${MonitorPresentation.activationThreshold->Int.toString}% activation target`,
    ]->Array.join(", "),
  }
}
