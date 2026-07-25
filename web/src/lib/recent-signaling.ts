export const RECENT_WINDOWS = [48, 144] as const;

export type RecentWindow = (typeof RECENT_WINDOWS)[number];

export const DEFAULT_RECENT_WINDOW: RecentWindow = 48;

export const RECENT_WINDOW_PARAM = "window";

const BLOCK_DATA_UNAVAILABLE = "Block data unavailable.";

interface SignalingBlock {
  height: number;
  signaling: boolean;
}

export interface RecentSignaling {
  /** requested window size */
  window: RecentWindow;
  /** blocks actually available, never more than the window */
  sampled: number;
  signaling: number;
  pct: number;
  partial: boolean;
}

/**
 * Share of the most recent blocks that signaled, as a rolling window over the
 * newest `window` blocks.
 */
export function recentSignaling(
  blocks: readonly SignalingBlock[],
  window: RecentWindow,
): RecentSignaling {
  // the payload is scraped from upstream HTML, so do not trust its ordering
  const newest = [...blocks]
    .sort((a, b) => b.height - a.height)
    .slice(0, window);
  const signaling = newest.filter((block) => block.signaling).length;

  return {
    window,
    sampled: newest.length,
    signaling,
    pct: newest.length === 0 ? 0 : (signaling / newest.length) * 100,
    partial: newest.length < window,
  };
}

/** Reads the window from a `?window=` value, falling back to the default */
export function parseRecentWindow(value: string | null): RecentWindow {
  const parsed = Number(value);

  return (
    RECENT_WINDOWS.find((window) => window === parsed) ?? DEFAULT_RECENT_WINDOW
  );
}

/**
 * Search params carrying the selected window, omitting it at the default so
 * the shared URL stays clean.
 */
export function recentWindowSearch(
  search: string,
  window: RecentWindow,
): string {
  const params = new URLSearchParams(search);

  if (window === DEFAULT_RECENT_WINDOW) {
    params.delete(RECENT_WINDOW_PARAM);
  } else {
    params.set(RECENT_WINDOW_PARAM, String(window));
  }

  const next = params.toString();

  return next ? `?${next}` : "";
}

export function recentWindowHeading(window: RecentWindow): string {
  return `Last ${window} blocks`;
}

export function recentWindowDuration(window: RecentWindow): string {
  return window === 48 ? "roughly 8 hours" : "roughly a day";
}

export function recentSignalingCounts(recent: RecentSignaling): string {
  if (recent.sampled === 0) return BLOCK_DATA_UNAVAILABLE;

  return `${recent.signaling} of ${recent.sampled} recent blocks signaled for BIP-110`;
}

export function recentSignalingDetail(
  recent: RecentSignaling,
  periodPct: number,
  periodNum: number,
): string {
  // the counts line already carries the unavailable message
  if (recent.sampled === 0) return "";

  if (recent.partial) {
    return `Only ${recent.sampled} blocks have been mined since period ${periodNum} began, so this window covers ${recent.sampled} blocks.`;
  }

  return `The period rate is ${periodPct.toFixed(2)}%. This window covers ${recentWindowDuration(recent.window)}.`;
}
