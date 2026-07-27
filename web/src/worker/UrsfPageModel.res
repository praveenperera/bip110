type chartPoint = {
  period: Monitor.monitorPeriod,
  x: float,
}

let maxInt = (left, right) => left > right ? left : right
let formatInteger = MonitorPresentation.formatInteger

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

let historyPeriods = (data: Monitor.monitorData) => {
  let currentPeriod: Monitor.monitorPeriod = {
    periodNum: data.periodNum,
    startBlock: data.periodStart,
    endBlock: data.periodEnd,
    signalingCount: 0,
    totalBlocks: data.totalBlocks,
    pct: 0.0,
  }
  let previousPeriods =
    data.periods
    ->Array.filter(period => period.periodNum !== data.periodNum)
    ->Array.map(period => {
      ...period,
      pct: 0.0,
      signalingCount: 0,
    })
    ->Array.toSorted((left, right) => Int.compare(right.periodNum, left.periodNum))

  Array.concat([currentPeriod], previousPeriods)
}

@genType
let monitorFields = (data: Monitor.monitorData) => {
  let blocksLeft = maxInt(data.periodEnd - data.tip, 0)
  let previousPeriodStart = data.periodStart - Monitor.periodSize
  let previousPeriodEnd = data.periodStart - 1
  let periodSize = formatInteger(Monitor.periodSize)

  Dict.fromArray([
    ("blocks-left", formatInteger(blocksLeft)),
    ("blocks-left-detail", formatEstimatedTime(blocksLeft)),
    ("chain-tip", formatInteger(data.chainTip)),
    ("chain-tip-detail", "Latest Bitcoin chain height"),
    ("history-current-end", formatInteger(data.periodEnd)),
    ("history-current-period", formatInteger(data.periodNum)),
    ("history-current-start", formatInteger(data.periodStart)),
    ("history-current-tracked", `${formatInteger(data.totalBlocks)} / ${periodSize}`),
    ("history-previous-end", formatInteger(previousPeriodEnd)),
    ("history-previous-period", formatInteger(data.periodNum - 1)),
    ("history-previous-start", formatInteger(previousPeriodStart)),
    ("history-previous-tracked", `${periodSize} / ${periodSize}`),
    ("indexed-tip", formatInteger(data.tip)),
    ("indexed-tip-detail", "Current Bitcoin block height"),
    ("period-end", formatInteger(data.periodEnd)),
    ("period-num", formatInteger(data.periodNum)),
    ("period-progress", `${formatInteger(data.totalBlocks)} / ${periodSize}`),
    ("period-start", formatInteger(data.periodStart)),
    ("status-period", formatInteger(data.periodNum)),
  ])
}

@genType
let periodProgressPercent = (data: Monitor.monitorData) =>
  Math.min(
    Math.max(data.totalBlocks->Int.toFloat /. Monitor.periodSize->Int.toFloat *. 100.0, 0.0),
    100.0,
  )

@genType
let historyTableRowsHtml = (data: Monitor.monitorData) =>
  historyPeriods(data)
  ->Array.map(period => {
    let isCurrentPeriod = period.periodNum === data.periodNum
    let rowClass = isCurrentPeriod ? " class=\"ursf-current-period\"" : ""
    let currentBadge = isCurrentPeriod
      ? "<span class=\"ursf-current-badge inline-flex h-5 items-center rounded-full border px-2 text-[0.7rem] font-medium leading-none\">Current</span>"
      : ""

    [
      `<tr${rowClass}>`,
      "<td class=\"ursf-heading py-3 pl-4 pr-4 font-medium\">",
      "<div class=\"flex flex-wrap items-center gap-2\">",
      `<span>${formatInteger(period.periodNum)}</span>`,
      currentBadge,
      "</div>",
      "</td>",
      `<td class="ursf-muted py-3 pr-4 font-mono">${formatInteger(period.startBlock)}</td>`,
      `<td class="ursf-muted py-3 pr-4 font-mono">${formatInteger(period.endBlock)}</td>`,
      `<td class="ursf-muted py-3 pr-4 font-mono">${formatInteger(
          period.totalBlocks,
        )} / ${formatInteger(Monitor.periodSize)}</td>`,
      "<td class=\"ursf-alert py-3 pr-4 font-mono font-semibold\">0</td>",
      "<td class=\"ursf-alert py-3 font-mono font-semibold\">0.00%</td>",
      "</tr>",
    ]->Array.join("")
  })
  ->Array.join("")

let periodChartY = (value, maxValue, top, height) => top +. height -. value /. maxValue *. height

let periodChartX = (index, pointCount, left, width) =>
  pointCount === 1
    ? left +. width /. 2.0
    : left +. width /. (pointCount - 1)->Int.toFloat *. index->Int.toFloat

@genType
let periodChartHtml = (data: Monitor.monitorData) => {
  let periods =
    historyPeriods(data)->Array.toSorted((left, right) =>
      Int.compare(left.periodNum, right.periodNum)
    )

  if periods->Array.length === 0 {
    [
      "<div class=\"ursf-muted rounded-lg border border-dashed border-[var(--ursf-border)] bg-[var(--ursf-soft)] p-6 text-sm\">",
      "No period history available for charting.",
      "</div>",
    ]->Array.join("")
  } else {
    let chartWidth = maxInt(1440, periods->Array.length * 160 + 160)
    let chartHeight = 288
    let marginBottom = 58.0
    let marginLeft = 64.0
    let marginRight = 24.0
    let marginTop = 28.0
    let plotHeight = chartHeight->Int.toFloat -. marginTop -. marginBottom
    let plotWidth = chartWidth->Int.toFloat -. marginLeft -. marginRight
    let maxValue = 5.0
    let yTicks = [5, 3, 0]
    let pointY = marginTop +. plotHeight
    let points: array<chartPoint> = periods->Array.mapWithIndex((period, index) => {
      period,
      x: periodChartX(index, periods->Array.length, marginLeft, plotWidth),
    })
    let linePath =
      points
      ->Array.mapWithIndex((point, index) =>
        `${index === 0 ? "M" : "L"} ${point.x->Float.toString} ${pointY->Float.toString}`
      )
      ->Array.join(" ")
    let yTickHtml =
      yTicks
      ->Array.map(tick => {
        let y = periodChartY(tick->Int.toFloat, maxValue, marginTop, plotHeight)
        [
          "<g>",
          `<line x1="${marginLeft->Float.toString}" x2="${(chartWidth->Int.toFloat -. marginRight)
              ->Float.toString}" y1="${y->Float.toString}" y2="${y->Float.toString}" stroke="currentColor" stroke-opacity="0.16" />`,
          `<text x="${(marginLeft -. 12.0)->Float.toString}" y="${(y +. 4.0)
              ->Float.toString}" text-anchor="end" class="fill-current font-mono text-[11px]">${formatInteger(
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
        let isCurrentPeriod = period.periodNum === data.periodNum
        let title = `Period ${period.periodNum->Int.toString}: 0 signaling blocks (0.00%)`
        let currentLabel = isCurrentPeriod
          ? `<text x="${x->Float.toString}" y="${(chartHeight - 14)
                ->Int.toString}" text-anchor="middle" class="fill-[var(--ursf-alert)] text-[10px] font-medium">current</text>`
          : ""

        [
          `<g aria-label="${title}" class="period-chart-point outline-none" role="img" tabindex="0">`,
          `<title>${title}</title>`,
          `<circle cx="${x->Float.toString}" cy="${pointY->Float.toString}" r="${isCurrentPeriod
              ? "5.5"
              : "4.5"}" class="transition-[r,fill] duration-150" fill="var(--ursf-alert)" stroke="var(--ursf-bg)" stroke-width="3" />`,
          "<g class=\"period-chart-tooltip\">",
          `<rect x="${(x -. 34.0)->Float.toString}" y="${(pointY -. 40.0)
              ->Float.toString}" width="68" height="24" rx="6" class="fill-[var(--ursf-card)] stroke-[var(--ursf-border)]" />`,
          `<text x="${x->Float.toString}" y="${(pointY -. 23.0)
              ->Float.toString}" text-anchor="middle" class="fill-[var(--ursf-heading)] font-mono text-[11px]">0.00%</text>`,
          "</g>",
          `<text x="${x->Float.toString}" y="${(pointY -. 12.0)
              ->Float.toString}" text-anchor="middle" class="fill-current font-mono text-[11px]">0</text>`,
          `<text x="${x->Float.toString}" y="${(chartHeight - 31)
              ->Int.toString}" text-anchor="middle" class="fill-current font-mono text-[11px]">${formatInteger(
              period.periodNum,
            )}</text>`,
          currentLabel,
          "</g>",
        ]->Array.join("")
      })
      ->Array.join("")

    [
      "<div class=\"flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between\">",
      "<div>",
      "<h3 class=\"ursf-heading text-base font-semibold tracking-tight\">URSF blocks by period</h3>",
      "<p class=\"ursf-muted mt-1 text-sm\">The line remains at zero because no URSF signaling blocks are tracked.</p>",
      "</div>",
      "<div class=\"ursf-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-xs\">",
      "<span class=\"inline-flex items-center gap-2\"><span class=\"size-3 rounded-full border-2 border-[var(--ursf-alert)] bg-[var(--ursf-bg)]\" aria-hidden=\"true\"></span>URSF blocks</span>",
      "</div>",
      "</div>",
      `<div class="ursf-muted mt-5 overflow-x-auto" role="img" aria-label="URSF block counts by difficulty adjustment period. Chart maximum is ${formatInteger(
          5,
        )} blocks.">`,
      "<div class=\"w-max\">",
      `<svg class="max-w-none" width="${chartWidth->Int.toString}" height="${chartHeight->Int.toString}" viewBox="0 0 ${chartWidth->Int.toString} ${chartHeight->Int.toString}">`,
      yTickHtml,
      `<line x1="${marginLeft->Float.toString}" x2="${marginLeft->Float.toString}" y1="${marginTop->Float.toString}" y2="${(marginTop +.
        plotHeight)->Float.toString}" stroke="currentColor" stroke-opacity="0.28" />`,
      `<line x1="${marginLeft->Float.toString}" x2="${(chartWidth->Int.toFloat -. marginRight)
          ->Float.toString}" y1="${(marginTop +. plotHeight)->Float.toString}" y2="${(marginTop +.
        plotHeight)->Float.toString}" stroke="currentColor" stroke-opacity="0.28" />`,
      `<path d="${linePath}" fill="none" stroke="var(--ursf-alert)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" />`,
      pointHtml,
      "</svg>",
      "<p class=\"text-center text-[11px]\">difficulty adjustment period</p>",
      "</div>",
      "</div>",
    ]->Array.join("")
  }
}
