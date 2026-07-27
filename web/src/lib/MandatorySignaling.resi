/** Calendar-style units shown in the mandatory-signaling countdown */
@genType
type countdown = {
  days: int,
  hours: int,
  minutes: int,
  seconds: int,
}

/** Current phase of the mandatory-signaling estimate */
@genType
type estimateStatus = [#pending | #reached]

/** Current distance and estimated time to the mandatory-signaling phase */
@genType
type estimate = {
  status: estimateStatus,
  blocksRemaining: int,
  countdown: countdown,
}

/** Block height at which mandatory BIP-110 signaling begins */
@genType
let mandatorySignalingHeight: int

/** Estimated Bitcoin block interval used for the mandatory-signaling countdown */
@genType
let estimatedBlockIntervalSeconds: int

/** Returns whether the mandatory-signaling countdown should still be shown */
@genType
let shouldShowMandatorySignaling: int => bool

/** Estimates when mandatory signaling will begin from an observed chain tip */
@genType
let mandatorySignalingExpectedAt: (int, float) => Nullable.t<float>

/** Estimates the distance to mandatory signaling from an indexed chain tip */
@genType
let mandatorySignalingEstimate: (int, ~elapsedSeconds: int=?) => estimate
