/** Supported recent-block window sizes */
export const RECENT_WINDOWS = [48, 72, 144] as const;

/** Supported number of recent blocks to summarize */
export type RecentWindow = (typeof RECENT_WINDOWS)[number];

/** Recent-block window used when the URL does not select one */
export const DEFAULT_RECENT_WINDOW: RecentWindow = 48;

/** Query parameter that selects the recent-block window */
export const RECENT_WINDOW_PARAM = "window";

const BLOCK_DATA_UNAVAILABLE = "Block data unavailable.";

interface SignalingBlock {
  height: number;
  signaling: boolean;
}

/** Signaling summary for a recent block window */
export interface RecentSignaling {
  /** Requested window size */
  window: RecentWindow;
  /** Blocks actually available, never more than the window */
  sampled: number;
  signaling: number;
  pct: number;
  partial: boolean;
}

/**
 * Share of the most recent blocks that signaled, as a rolling window over the
 * newest `window` blocks
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
 * the shared URL stays clean
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

/** Formats a heading for a recent-block window */
export function recentWindowHeading(window: RecentWindow): string {
  return `Last ${window} blocks`;
}

// blocks target ten minutes apart
const RECENT_WINDOW_DURATIONS: Record<RecentWindow, string> = {
  48: "roughly the last 8 hours",
  72: "roughly the last 12 hours",
  144: "roughly the last day",
};

/** Describes the target elapsed time for a recent-block window */
export function recentWindowDuration(window: RecentWindow): string {
  return RECENT_WINDOW_DURATIONS[window];
}

/** Formats the signaling count for a recent-block summary */
export function recentSignalingCounts(recent: RecentSignaling): string {
  if (recent.sampled === 0) return BLOCK_DATA_UNAVAILABLE;

  return `${recent.signaling} of ${recent.sampled} recent blocks signaled for BIP-110`;
}

/** Formats supporting detail for a recent-block summary */
export function recentSignalingDetail(
  recent: RecentSignaling,
  periodNum: number,
): string {
  // the counts line already carries the unavailable message
  if (recent.sampled === 0) return "";

  if (recent.partial) {
    return `Only ${recent.sampled} blocks have been mined since period ${periodNum} began, so this window covers ${recent.sampled} blocks.`;
  }

  return `This window covers ${recentWindowDuration(recent.window)}.`;
}
