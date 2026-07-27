@genType
type countdown = {
  days: int,
  hours: int,
  minutes: int,
  seconds: int,
}

@genType
type estimateStatus = [#pending | #reached]

@genType
type estimate = {
  status: estimateStatus,
  blocksRemaining: int,
  countdown: countdown,
}

@genType
let mandatorySignalingHeight = 961_632

@genType
let estimatedBlockIntervalSeconds =
  10 * 60

let secondsPerDay = 24 * 60 * 60
let secondsPerHour = 60 * 60
let secondsPerMinute = 60
let maxInt = (left, right) => left > right ? left : right

@genType
let shouldShowMandatorySignaling = tip => tip < mandatorySignalingHeight

@genType
let mandatorySignalingExpectedAt = (tip, observedAt) => {
  if !shouldShowMandatorySignaling(tip) || !Float.isFinite(observedAt) {
    Nullable.null
  } else {
    let blocksRemaining = mandatorySignalingHeight - tip

    Nullable.make(
      observedAt +.
      blocksRemaining->Int.toFloat *. estimatedBlockIntervalSeconds->Int.toFloat *. 1000.0,
    )
  }
}

let countdownFromSeconds = totalSeconds => {
  let days = totalSeconds / secondsPerDay
  let afterDays = mod(totalSeconds, secondsPerDay)
  let hours = afterDays / secondsPerHour
  let afterHours = mod(afterDays, secondsPerHour)
  let minutes = afterHours / secondsPerMinute
  let seconds = mod(afterHours, secondsPerMinute)

  {days, hours, minutes, seconds}
}

@genType
let mandatorySignalingEstimate = (tip, ~elapsedSeconds=0) => {
  let blocksRemaining = maxInt(mandatorySignalingHeight - tip, 0)
  let estimatedSeconds = maxInt(
    blocksRemaining * estimatedBlockIntervalSeconds - maxInt(elapsedSeconds, 0),
    0,
  )
  let countdown = countdownFromSeconds(estimatedSeconds)

  if shouldShowMandatorySignaling(tip) {
    {status: #pending, blocksRemaining, countdown}
  } else {
    {status: #reached, blocksRemaining: 0, countdown}
  }
}
