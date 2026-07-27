@genType
type highlightStat = {
  label: string,
  value: string,
  detail: string,
}

@genType
type dashboardStats = {
  blocksLeft: int,
  periodProgress: float,
  activationProgress: float,
  signalingDeficit: int,
  historyPeriods: array<Monitor.monitorPeriod>,
}

@genType
type periodChartMetric = [#blocks | #percentage]

@genType
type periodChartDatum = {
  periodNum: int,
  startBlock: int,
  endBlock: int,
  signalingCount: int,
  totalBlocks: int,
  pct: float,
  isCurrent: bool,
  label: string,
  pctLabel: string,
  signalingLabel: string,
}

@genType
type periodChartModel = {
  data: array<periodChartDatum>,
  showingPercentage: bool,
  maxValue: float,
  midValue: float,
  yTicks: array<float>,
  metricLabel: string,
  maximumLabel: string,
}

@genType
type countdownUnit = {
  label: string,
  value: int,
  displayValue: string,
}

@genType
type mandatorySignalingModel = {
  blocksRemaining: int,
  expectedAt: Nullable.t<float>,
  target: string,
  units: array<countdownUnit>,
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
let clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum)

@genType
let periodBlockCount = Monitor.periodSize

@genType
let activationThreshold = MonitorPresentation.activationThreshold

@genType
let requiredSignalingBlocks =
  (periodBlockCount * activationThreshold + 99) / 100

@genType
let formatNumber = MonitorPresentation.formatInteger

@genType
let formatPercent = MonitorPresentation.formatPercent

@genType
let formatBlockCount = value => `${formatNumber(value)} ${value === 1 ? "block" : "blocks"}`

@genType
let formatSignalingBlockCount = value =>
  `${formatNumber(value)} signaling ${value === 1 ? "block" : "blocks"}`

@genType
let formatChartPercent = value => `${chartPercentFormatter->Intl.NumberFormat.format(value)}%`

@genType
let monitorLagStatus = (data: Monitor.monitorData) => {
  let lagBlocks = maxInt(data.chainTip - data.tip, 0)

  if data.synced && lagBlocks === 0 {
    Nullable.null
  } else if lagBlocks === 0 {
    Nullable.make("Monitor index catching up")
  } else {
    Nullable.make(`Monitor lagging by ${formatBlockCount(lagBlocks)}`)
  }
}

let formatDate = date =>
  date->Date.getTime->Float.isNaN ? "Unknown" : dateTimeFormatter->Intl.DateTimeFormat.format(date)

@genType
let formatDateTime = milliseconds => milliseconds->Date.fromTime->formatDate

@genType
let formatUpdatedAt = value => value->Date.fromString->formatDate

@genType
let formatCacheAge = (cachedAt, now) => {
  let seconds = maxInt(Math.Int.floor((now -. cachedAt) /. 1000.0), 0)

  if seconds < 5 {
    "just now"
  } else if seconds < 60 {
    `${seconds->Int.toString}s ago`
  } else {
    let minutes = seconds / 60

    if minutes < 60 {
      `${minutes->Int.toString}m ago`
    } else {
      `${(minutes / 60)->Int.toString}h ago`
    }
  }
}

@genType
let isCacheStale = (cachedAt, now, ~ttlMs) => now -. cachedAt > ttlMs->Int.toFloat

@genType
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

@genType
let clampPercent = value => clamp(value, 0.0, 100.0)

let currentPeriod = (data: Monitor.monitorData): Monitor.monitorPeriod => {
  periodNum: data.periodNum,
  startBlock: data.periodStart,
  endBlock: data.periodEnd,
  signalingCount: data.signalingCount,
  totalBlocks: data.totalBlocks,
  pct: data.pct,
}

@genType
let historyPeriods = (data: Monitor.monitorData) => {
  let previousPeriods =
    data.periods
    ->Array.filter(period => period.periodNum !== data.periodNum)
    ->Array.toSorted((left, right) => Int.compare(right.periodNum, left.periodNum))

  Array.concat([currentPeriod(data)], previousPeriods)
}

@genType
let dashboardStats = (data: Monitor.monitorData) => {
  let blocksLeft = maxInt(data.periodEnd - data.tip, 0)

  {
    blocksLeft,
    periodProgress: clampPercent(
      data.totalBlocks->Int.toFloat /. periodBlockCount->Int.toFloat *. 100.0,
    ),
    activationProgress: clampPercent(data.pct /. activationThreshold->Int.toFloat *. 100.0),
    signalingDeficit: maxInt(requiredSignalingBlocks - data.signalingCount, 0),
    historyPeriods: historyPeriods(data),
  }
}

@genType
let highlightStats = (data: Monitor.monitorData) => {
  let stats = dashboardStats(data)

  [
    {
      label: "Signal rate",
      value: formatPercent(data.pct),
      detail: `${formatNumber(data.signalingCount)} of ${formatNumber(data.totalBlocks)} blocks`,
    },
    {
      label: "Blocks left",
      value: formatNumber(stats.blocksLeft),
      detail: `${formatEstimatedTime(stats.blocksLeft)} in this period`,
    },
    {
      label: "Period progress",
      value: formatPercent(stats.periodProgress),
      detail: `${formatNumber(stats.signalingDeficit)} more signals needed`,
    },
  ]
}

@genType
let periodChartModel = (
  periods: array<Monitor.monitorPeriod>,
  currentPeriodNum,
  metric: periodChartMetric,
) => {
  let sortedPeriods =
    periods->Array.toSorted((left, right) => Int.compare(left.periodNum, right.periodNum))
  let showingPercentage = metric === #percentage
  let maxValue = if showingPercentage {
    let highestPercent =
      sortedPeriods->Array.reduce(0.0, (highest, period) => Math.max(highest, period.pct))

    Math.min(Math.max(Math.ceil(highestPercent *. 1.1 *. 100.0) /. 100.0, 1.0), 100.0)
  } else {
    sortedPeriods
    ->Array.reduce(0, (highest, period) => maxInt(highest, period.signalingCount))
    ->Int.toFloat +. 5.0
  }
  let midValue = showingPercentage
    ? Math.round(maxValue /. 2.0 *. 100.0) /. 100.0
    : Math.round(maxValue /. 2.0)
  let metricLabel = showingPercentage ? "Signaling %" : "Signaling blocks"
  let data = sortedPeriods->Array.map(period => {
    periodNum: period.periodNum,
    startBlock: period.startBlock,
    endBlock: period.endBlock,
    signalingCount: period.signalingCount,
    totalBlocks: period.totalBlocks,
    pct: period.pct,
    isCurrent: period.periodNum === currentPeriodNum,
    label: period.periodNum->Int.toString,
    pctLabel: formatPercent(period.pct),
    signalingLabel: formatSignalingBlockCount(period.signalingCount),
  })

  {
    data,
    showingPercentage,
    maxValue,
    midValue,
    yTicks: [maxValue, midValue, 0.0],
    metricLabel,
    maximumLabel: showingPercentage
      ? formatChartPercent(maxValue)
      : formatSignalingBlockCount(Math.round(maxValue)->Float.toInt),
  }
}

let elapsedSecondsSince = (value, now) => {
  let timestamp = value->Date.fromString->Date.getTime
  timestamp->Float.isNaN ? 0 : maxInt(Math.Int.floor((now -. timestamp) /. 1000.0), 0)
}

let countdownUnit = (label, value) => {
  label,
  value,
  displayValue: value->Int.toString->String.padStart(2, "0"),
}

@genType
let mandatorySignalingModel = (data: Monitor.monitorData, now) => {
  let observedAt = data.updatedAt->Date.fromString->Date.getTime
  let estimate = MandatorySignaling.mandatorySignalingEstimate(
    data.tip,
    ~elapsedSeconds=elapsedSecondsSince(data.updatedAt, now),
  )

  {
    blocksRemaining: estimate.blocksRemaining,
    expectedAt: MandatorySignaling.mandatorySignalingExpectedAt(data.tip, observedAt),
    target: formatNumber(MandatorySignaling.mandatorySignalingHeight),
    units: [
      countdownUnit("Days", estimate.countdown.days),
      countdownUnit("Hrs", estimate.countdown.hours),
      countdownUnit("Min", estimate.countdown.minutes),
      countdownUnit("Sec", estimate.countdown.seconds),
    ],
  }
}

@genType
let isMonitorSectionId = value =>
  switch value {
  | "current-period"
  | "rules"
  | "difficulty-adjustment-period-history"
  | "recent-signaling"
  | "block-grid" => true
  | _ => false
  }
