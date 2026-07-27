let signalBarWidth = 980
let signalBarX = 110
let maxPeriodNum = 2_147_483_647 / Monitor.periodSize
let epochTimestamp = "1970-01-01T00:00:00.000Z"

@genType
type imageParams = {
  period: Nullable.t<string>,
  tip: Nullable.t<string>,
  blocks: Nullable.t<string>,
  signals: Nullable.t<string>,
  pct: Nullable.t<string>,
  updated: Nullable.t<string>,
}

@genType
type renderPlan = {
  signalWidth: int,
  thresholdX: int,
  periodProgressWidth: int,
  periodProgressLabel: string,
  pctLabel: string,
  periodLabel: string,
  blocksLabel: string,
  tipLabel: string,
  thresholdLabel: string,
  thresholdPercentLabel: string,
}

let requiredValues = params => [
  params.period,
  params.tip,
  params.blocks,
  params.signals,
  params.pct,
]

@genType
let hasImageParams = params =>
  params->requiredValues->Array.some(value => !Nullable.isNullable(value))

let parseNonnegativeInt = (value, maximum) =>
  switch value->Nullable.toOption {
  | Some(value) if RegExp.test(/^\d+$/, value) =>
    switch Float.fromString(value) {
    | Some(parsed)
      if parsed->JsNumber.isSafeInteger && parsed >= 0.0 && parsed <= maximum->Int.toFloat =>
      Some(parsed->Float.toInt)
    | Some(_) | None => None
    }
  | Some(_) | None => None
  }

let parseNonnegativeFloat = value =>
  switch value->Nullable.toOption {
  | Some(value) if RegExp.test(/^\d+(\.\d+)?$/, value) =>
    switch Float.fromString(value) {
    | Some(parsed) if parsed->Float.isFinite => Some(parsed)
    | Some(_) | None => None
    }
  | Some(_) | None => None
  }

@genType
let parseImageData = params => {
  if !(params->hasImageParams) {
    Nullable.null
  } else {
    switch (
      parseNonnegativeInt(params.period, maxPeriodNum),
      parseNonnegativeInt(params.tip, 2_147_483_647),
      parseNonnegativeInt(params.blocks, Monitor.periodSize),
      parseNonnegativeInt(params.signals, Monitor.periodSize),
      parseNonnegativeFloat(params.pct),
    ) {
    | (Some(periodNum), Some(tip), Some(totalBlocks), Some(signalingCount), Some(pct)) =>
      let periodStart = periodNum * Monitor.periodSize
      let data: Monitor.monitorData = {
        bip: "110",
        tip,
        chainTip: tip,
        periodNum,
        periodStart,
        periodEnd: periodStart + Monitor.periodSize - 1,
        totalBlocks,
        signalingCount,
        pct,
        periods: [],
        synced: true,
        updatedAt: params.updated->Nullable.toOption->Option.getOr(epochTimestamp),
      }

      data->Monitor.isReasonableMonitorData ? data->Nullable.make : Nullable.null
    | _ => Nullable.null
    }
  }
}

@genType
let renderPlan = (data: Monitor.monitorData): renderPlan => {
  let pct = data.pct->Float.clamp(~min=0.0, ~max=100.0)
  let periodProgress =
    (data.totalBlocks->Int.toFloat /. Monitor.periodSize->Int.toFloat)
      ->Float.clamp(~min=0.0, ~max=1.0)
  let rawSignalWidth = Math.round(pct /. 100.0 *. signalBarWidth->Int.toFloat)->Float.toInt
  let signalWidth = data.signalingCount > 0 ? max(rawSignalWidth, 6) : rawSignalWidth
  let thresholdX =
    signalBarX +
    Math.round(
      MonitorPresentation.activationThreshold->Int.toFloat /. 100.0 *. signalBarWidth->Int.toFloat,
    )->Float.toInt
  let periodProgressPercent = Math.round(periodProgress *. 100.0)->Float.toInt

  {
    signalWidth,
    thresholdX,
    periodProgressWidth: Math.round(periodProgress *. signalBarWidth->Int.toFloat)->Float.toInt,
    periodProgressLabel: `PERIOD PROGRESS ${periodProgressPercent->Int.toString}%`,
    pctLabel: data.pct->MonitorPresentation.formatPercent,
    periodLabel: `PERIOD ${data.periodNum->Int.toString}`,
    blocksLabel: `${data.signalingCount->MonitorPresentation.formatInteger} OF ${data.totalBlocks->MonitorPresentation.formatInteger} BLOCKS`,
    tipLabel: `INDEXED TIP ${data.tip->MonitorPresentation.formatInteger}`,
    thresholdLabel: `${MonitorPresentation.activationThreshold->Int.toString}% ACTIVATION TARGET`,
    thresholdPercentLabel: `${MonitorPresentation.activationThreshold->Int.toString}%`,
  }
}
