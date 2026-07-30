/** Summary card displayed on the landing-page monitor */
@genType
type highlightStat = {
  label: string,
  value: string,
  detail: string,
}

/** Derived values shared across the full monitor dashboard */
@genType
type dashboardStats = {
  blocksLeft: int,
  periodProgress: float,
  activationProgress: float,
  signalingDeficit: int,
  historyPeriods: array<Monitor.monitorPeriod>,
}

/** Selectable metric in the period-history chart */
@genType
type periodChartMetric = [#blocks | #percentage]

/** One normalized point displayed by the period-history chart */
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

/** Complete data and scale model for the period-history chart */
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

/** One calendar unit displayed in the mandatory-signaling countdown */
@genType
type countdownUnit = {
  label: string,
  value: int,
  displayValue: string,
}

/** Derived mandatory-signaling countdown view model */
@genType
type mandatorySignalingModel = {
  blocksRemaining: int,
  expectedAt: Nullable.t<float>,
  target: string,
  units: array<countdownUnit>,
}

/** Number of blocks in one difficulty-adjustment period */
@genType
let periodBlockCount: int

/** Percentage of blocks required for early activation */
@genType
let activationThreshold: int

/** Minimum signaling blocks required for early activation */
@genType
let requiredSignalingBlocks: int

/** Formats an integer for dashboard presentation */
@genType
let formatNumber: int => string

/** Formats a dashboard percentage with two fractional digits */
@genType
let formatPercent: float => string

/** Formats a block count with singular or plural units */
@genType
let formatBlockCount: int => string

/** Formats a signaling-block count with singular or plural units */
@genType
let formatSignalingBlockCount: int => string

/** Formats a chart-axis percentage without unnecessary trailing zeros */
@genType
let formatChartPercent: float => string

/** Describes monitor lag or returns no status when fully synchronized */
@genType
let monitorLagStatus: Monitor.monitorData => Nullable.t<string>

/** Describes the monitor index without repeating a synchronized chain height */
@genType
let chainTipDetail: Monitor.monitorData => string

/** Formats an epoch-millisecond timestamp */
@genType
let formatDateTime: float => string

/** Formats an ISO monitor timestamp */
@genType
let formatUpdatedAt: string => string

/** Formats the age of a cached value relative to an explicit current time */
@genType
let formatCacheAge: (float, float) => string

/** Checks whether a cached value has exceeded its time-to-live */
@genType
let isCacheStale: (float, float, ~ttlMs: int) => bool

/** Estimates elapsed wall-clock time for a block count */
@genType
let formatEstimatedTime: int => string

/** Constrains a percentage to its visible range */
@genType
let clampPercent: float => float

/** Builds the current-first canonical period history */
@genType
let historyPeriods: Monitor.monitorData => array<Monitor.monitorPeriod>

/** Derives the full-dashboard progress and history model */
@genType
let dashboardStats: Monitor.monitorData => dashboardStats

/** Derives the three landing-page monitor summaries */
@genType
let highlightStats: Monitor.monitorData => array<highlightStat>

/** Builds sorted chart data and its scale for one selected metric */
@genType
let periodChartModel: (array<Monitor.monitorPeriod>, int, periodChartMetric) => periodChartModel

/** Builds the mandatory-signaling countdown from an explicit current time */
@genType
let mandatorySignalingModel: (Monitor.monitorData, float) => mandatorySignalingModel

/** Checks whether a hash targets a section owned by the monitor dashboard */
@genType
let isMonitorSectionId: string => bool
