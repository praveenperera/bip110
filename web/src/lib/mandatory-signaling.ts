/** Block height at which mandatory BIP-110 signaling begins */
export const MANDATORY_SIGNALING_HEIGHT = 961_632;

/** Estimated Bitcoin block interval used for the mandatory-signaling countdown */
export const ESTIMATED_BLOCK_INTERVAL_SECONDS = 10 * 60;

/** Calendar-style units shown in the mandatory-signaling countdown */
export interface MandatorySignalingCountdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Current distance and estimated time to the mandatory-signaling phase */
export type MandatorySignalingEstimate =
  | {
      status: "pending";
      blocksRemaining: number;
      countdown: MandatorySignalingCountdown;
    }
  | {
      status: "reached";
      blocksRemaining: 0;
      countdown: MandatorySignalingCountdown;
    };

const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_MINUTE = 60;

/** Returns whether the mandatory-signaling countdown should still be shown */
export function shouldShowMandatorySignaling(tip: number): boolean {
  return tip < MANDATORY_SIGNALING_HEIGHT;
}

/** Estimates the distance to mandatory signaling from an indexed chain tip */
export function mandatorySignalingEstimate(
  tip: number,
  elapsedSeconds = 0,
): MandatorySignalingEstimate {
  const blocksRemaining = Math.max(MANDATORY_SIGNALING_HEIGHT - tip, 0);
  const estimatedSeconds = Math.max(
    blocksRemaining * ESTIMATED_BLOCK_INTERVAL_SECONDS -
      Math.max(elapsedSeconds, 0),
    0,
  );
  const countdown = countdownFromSeconds(estimatedSeconds);

  if (!shouldShowMandatorySignaling(tip)) {
    return {
      status: "reached",
      blocksRemaining: 0,
      countdown,
    };
  }

  return {
    status: "pending",
    blocksRemaining,
    countdown,
  };
}

function countdownFromSeconds(
  totalSeconds: number,
): MandatorySignalingCountdown {
  const days = Math.floor(totalSeconds / SECONDS_PER_DAY);
  const afterDays = totalSeconds % SECONDS_PER_DAY;
  const hours = Math.floor(afterDays / SECONDS_PER_HOUR);
  const afterHours = afterDays % SECONDS_PER_HOUR;
  const minutes = Math.floor(afterHours / SECONDS_PER_MINUTE);
  const seconds = Math.floor(afterHours % SECONDS_PER_MINUTE);

  return { days, hours, minutes, seconds };
}
