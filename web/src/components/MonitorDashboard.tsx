import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { AlertCircle, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  currentPeriodGrid,
  isCleanMonitorBlock,
  isFirstMinerSignal,
  MONITOR_GRID_VISIBLE_BLOCKS,
  parseBlockMiningAttribution,
  parseMonitorBlocksPayload,
  parseMonitorData,
  type BlockMiningAttribution,
  type MonitorBlock,
  type MonitorBlocksPayload,
  type MonitorData,
  type MonitorGridBlock,
  type MonitorPeriod,
} from "@/lib/monitor";
import {
  DEFAULT_RECENT_WINDOW,
  parseRecentWindow,
  RECENT_WINDOW_PARAM,
  RECENT_WINDOWS,
  recentSignaling,
  recentSignalingCounts,
  recentSignalingDetail,
  recentWindowHeading,
  recentWindowSearch,
  type RecentWindow,
} from "@/lib/recent-signaling";
import { cn } from "@/lib/utils";

const API_URL = "/api/monitor";
const BLOCKS_API_URL = "/api/monitor-blocks";
const LOCAL_DEV_API_URL = "https://bip110monitor.com/api";
const MONITOR_URL = "https://bip110monitor.com";
const URSF_MONITOR_URL = "/ursf-monitor";
const MEMPOOL_BLOCK_URL = "https://mempool.guide/block";
const MEMPOOL_BLOCK_API_URL = "https://mempool.guide/api/v1/block";
const CACHE_KEY = "bip110-monitor-data";
const MONITOR_DATA_EVENT = "bip110-monitor-data";
const CACHE_VERSION = 2;
const CACHE_TTL_MS = 60_000;
const MONITOR_DATA_REFRESH_MS = 15_000;
const MONITOR_BLOCKS_REFRESH_MS = 10_000;
const PERIOD_BLOCK_COUNT = 2016;
const ACTIVATION_THRESHOLD = 55;
const VOLUNTARY_DEADLINE_BLOCK = 961542;
const VOLUNTARY_DEADLINE_PERIOD = 476;
const SIGNAL_BIT = 4;
const CURRENT_PERIOD_SECTION_ID = "current-period";
const RULES_SECTION_ID = "rules";
const HISTORY_SECTION_ID = "difficulty-adjustment-period-history";
const RECENT_SIGNALING_SECTION_ID = "recent-signaling";
const BLOCK_GRID_SECTION_ID = "block-grid";
const MONITOR_SECTION_IDS = [
  CURRENT_PERIOD_SECTION_ID,
  RULES_SECTION_ID,
  HISTORY_SECTION_ID,
  RECENT_SIGNALING_SECTION_ID,
  BLOCK_GRID_SECTION_ID,
] as const;
const REQUIRED_SIGNALING_BLOCKS = Math.ceil(
  PERIOD_BLOCK_COUNT * (ACTIVATION_THRESHOLD / 100),
);

type StatusCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "primary";
};

type MonitorHighlightStat = {
  label: string;
  value: string;
  detail: string;
};

type PeriodChartDatum = MonitorPeriod & {
  isCurrent: boolean;
  label: string;
  pctLabel: string;
  signalingLabel: string;
};

type PeriodChartMetric = "blocks" | "percentage";

type PeriodChartTooltipProps = {
  active?: boolean;
  metric: PeriodChartMetric;
  payload?: Array<{
    payload?: PeriodChartDatum;
  }>;
};

type CacheInfo = {
  cachedAt: number;
  source: "cache" | "network";
};

type CachedMonitorData = {
  cachedAt: number;
  data: MonitorData;
  version: typeof CACHE_VERSION;
};

type MonitorDataEventDetail = {
  cachedAt: number;
  data: MonitorData;
};

type BlockDataStatus = "loading" | "live" | "unavailable";

type MonitorBlockGridMode = "bip110" | "ursf";

type BlockMiningAttributionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; attribution: BlockMiningAttribution | null }
  | { status: "unavailable" };

const blockMiningAttributionRequests = new Map<
  string,
  Promise<BlockMiningAttribution | null>
>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCachedMonitorData(): CachedMonitorData | null {
  try {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as unknown;
    if (!isRecord(parsed)) return null;

    if (
      parsed.version !== CACHE_VERSION ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null;
    }

    return {
      cachedAt: parsed.cachedAt,
      data: parseMonitorData(parsed.data),
      version: CACHE_VERSION,
    };
  } catch {
    return null;
  }
}

function writeCachedMonitorData(data: MonitorData, cachedAt: number) {
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ cachedAt, data, version: CACHE_VERSION }),
    );
  } catch {}

  window.dispatchEvent(
    new CustomEvent<MonitorDataEventDetail>(MONITOR_DATA_EVENT, {
      detail: { cachedAt, data },
    }),
  );
}

function isPageVisible() {
  return document.visibilityState === "visible";
}

function isCacheStale(cachedAt: number) {
  return Date.now() - cachedAt > CACHE_TTL_MS;
}

function shouldRefreshCachedMonitorData() {
  const cached = readCachedMonitorData();
  return !cached || isCacheStale(cached.cachedAt);
}

function monitorDataEventDetail(event: Event): MonitorDataEventDetail | null {
  if (
    !(event instanceof CustomEvent) ||
    !isRecord(event.detail) ||
    typeof event.detail.cachedAt !== "number"
  ) {
    return null;
  }

  try {
    return {
      cachedAt: event.detail.cachedAt,
      data: parseMonitorData(event.detail.data),
    };
  } catch {
    return null;
  }
}

function isLocalDevHost() {
  return ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
}

async function fetchMonitorData(signal?: AbortSignal) {
  const response = await fetch(API_URL, {
    cache: "no-store",
    signal,
  });

  if (response.ok) {
    return parseMonitorData(await response.json());
  }

  if (response.status === 404 && isLocalDevHost()) {
    const fallbackResponse = await fetch(LOCAL_DEV_API_URL, {
      signal,
    });

    if (fallbackResponse.ok) {
      return parseMonitorData(await fallbackResponse.json());
    }

    throw new Error(`Monitor API returned ${fallbackResponse.status}`);
  }

  throw new Error(`Monitor API returned ${response.status}`);
}

async function fetchMonitorBlocks(
  expectedTip: number | null,
  signal?: AbortSignal,
) {
  const url = expectedTip
    ? `${BLOCKS_API_URL}?tip=${expectedTip}`
    : BLOCKS_API_URL;
  const response = await fetch(url, {
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`Monitor block API returned ${response.status}`);
  }

  return parseMonitorBlocksPayload(await response.json());
}

function fetchBlockMiningAttribution(
  hash: string,
): Promise<BlockMiningAttribution | null> {
  const existingRequest = blockMiningAttributionRequests.get(hash);
  if (existingRequest) return existingRequest;

  const request = fetch(`${MEMPOOL_BLOCK_API_URL}/${hash}`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Block explorer API returned ${response.status}`);
      }

      return parseBlockMiningAttribution(await response.json());
    })
    .catch((error: unknown) => {
      blockMiningAttributionRequests.delete(hash);
      throw error;
    });

  blockMiningAttributionRequests.set(hash, request);
  return request;
}

function useMonitorBlocks(
  expectedTip: number | null,
  onBlocks: (payload: MonitorBlocksPayload) => void,
) {
  const [blockDataStatus, setBlockDataStatus] =
    useState<BlockDataStatus>("loading");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const onBlocksRef = useRef(onBlocks);
  const lastLoadedAtRef = useRef<number | null>(null);

  useEffect(() => {
    onBlocksRef.current = onBlocks;
  }, [onBlocks]);

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    let loading = false;

    const loadBlocks = async () => {
      if (loading || !isPageVisible()) return;

      loading = true;
      controller = new AbortController();

      try {
        const payload = await fetchMonitorBlocks(
          expectedTip,
          controller.signal,
        );
        if (!active) return;

        lastLoadedAtRef.current = Date.now();
        onBlocksRef.current(payload);
        setBlockDataStatus("live");
      } catch (nextError) {
        if (
          nextError instanceof DOMException &&
          nextError.name === "AbortError"
        ) {
          return;
        }

        if (active) {
          setBlockDataStatus("unavailable");
        }
      } finally {
        loading = false;
      }
    };

    const loadBlocksIfStale = () => {
      const lastLoadedAt = lastLoadedAtRef.current;

      if (!lastLoadedAt || isCacheStale(lastLoadedAt)) {
        void loadBlocks();
      }
    };

    void loadBlocks();
    const refreshTimer = window.setInterval(
      loadBlocks,
      MONITOR_BLOCKS_REFRESH_MS,
    );
    window.addEventListener("focus", loadBlocksIfStale);
    document.addEventListener("visibilitychange", loadBlocksIfStale);

    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", loadBlocksIfStale);
      document.removeEventListener("visibilitychange", loadBlocksIfStale);
    };
  }, [expectedTip, refreshIndex]);

  const refreshBlocks = useCallback(() => {
    setRefreshIndex((index) => index + 1);
  }, []);

  return { blockDataStatus, refreshBlocks };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatBlockCount(value: number) {
  return `${formatNumber(value)} ${value === 1 ? "block" : "blocks"}`;
}

function formatSignalingBlockCount(value: number) {
  return `${formatNumber(value)} signaling ${value === 1 ? "block" : "blocks"}`;
}

function monitorLagStatus(data: MonitorData) {
  const lagBlocks = Math.max(data.chainTip - data.tip, 0);

  if (data.synced && lagBlocks === 0) return null;

  if (lagBlocks === 0) return "Monitor index catching up";

  return `Monitor lagging by ${formatBlockCount(lagBlocks)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function formatCacheAge(cachedAt: number) {
  const seconds = Math.max(Math.floor((Date.now() - cachedAt) / 1000), 0);

  if (seconds < 5) {
    return "just now";
  }

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function formatEstimatedTime(blocks: number) {
  const minutes = blocks * 10;
  const days = minutes / 1440;

  if (days >= 2) {
    return `~${days.toFixed(days >= 10 ? 0 : 1)} days`;
  }

  const hours = minutes / 60;

  if (hours >= 1) {
    return `~${hours.toFixed(hours >= 10 ? 0 : 1)} hours`;
  }

  return `~${minutes} minutes`;
}

function clampPercent(value: number) {
  return Math.min(Math.max(value, 0), 100);
}

function formatBlockVersion(value: number | undefined) {
  if (value === undefined) return "Unavailable";

  return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}

function formatBlockTime(value: number | undefined) {
  if (value === undefined) return "Unavailable";

  return `${new Date(value * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 16)} UTC`;
}

function formatBlockTransactions(value: number | undefined) {
  return value === undefined ? "Unavailable" : formatNumber(value);
}

function formatBlockMiner(attribution: BlockMiningAttribution | null) {
  if (!attribution) return "Unknown";
  if (!attribution.templateMinerName) return attribution.poolName;

  return `${attribution.poolName} (${attribution.templateMinerName})`;
}

function blockServerAttributionState(
  block: MonitorGridBlock,
): BlockMiningAttributionState | null {
  if (block.kind !== "known" || !block.signaling) return null;

  if (block.signalingMiner.status === "identified") {
    return {
      status: "loaded",
      attribution: block.signalingMiner.attribution,
    };
  }

  if (block.signalingMiner.status === "unidentified") {
    return { status: "loaded", attribution: null };
  }

  return null;
}

function formatBlockStatus(
  block: MonitorGridBlock,
  mode: MonitorBlockGridMode,
) {
  if (mode === "ursf") {
    return "not signaling";
  }

  if (block.kind === "known" && block.signaling) {
    return "SIGNALING BIP-110";
  }

  if (block.kind === "known") {
    return "not signaling";
  }

  return "signal status unavailable";
}

function mergePeriodBlocks(
  data: MonitorData,
  blocks: MonitorBlock[] | null,
): MonitorGridBlock[] {
  return currentPeriodGrid(data, blocks);
}

function currentPeriodFromMonitorData(data: MonitorData): MonitorPeriod {
  return {
    periodNum: data.periodNum,
    startBlock: data.periodStart,
    endBlock: data.periodEnd,
    signalingCount: data.signalingCount,
    totalBlocks: data.totalBlocks,
    pct: data.pct,
  };
}

function monitorHistoryPeriods(data: MonitorData): MonitorPeriod[] {
  const previousPeriods = data.periods
    .filter((period) => period.periodNum !== data.periodNum)
    .sort((a, b) => b.periodNum - a.periodNum);

  return [currentPeriodFromMonitorData(data), ...previousPeriods];
}

function StatusCard({
  label,
  value,
  detail,
  tone = "default",
}: StatusCardProps) {
  return (
    <Card
      className={cn(
        "border-border/50 bg-card/50 backdrop-blur",
        tone === "primary" && "border-primary/25 bg-primary/5",
      )}
    >
      <CardContent className="pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function ProgressRow({
  label,
  value,
  detail,
  percent,
  className,
}: {
  label: string;
  value: string;
  detail: string;
  percent: number;
  className?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{detail}</p>
        </div>
        <p className="font-mono text-sm text-muted-foreground">{value}</p>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full bg-primary transition-[width] duration-500",
            className,
          )}
          style={{ width: `${clampPercent(percent)}%` }}
        />
      </div>
    </div>
  );
}

function chartPeriods(periods: MonitorPeriod[]) {
  return [...periods].sort((a, b) => a.periodNum - b.periodNum);
}

function chartMaxSignalingCount(periods: MonitorPeriod[]) {
  return Math.max(...periods.map((period) => period.signalingCount), 0) + 5;
}

function chartMaxSignalingPercent(periods: MonitorPeriod[]) {
  const highestPercent = Math.max(...periods.map((period) => period.pct), 0);

  return Math.min(
    Math.max(Math.ceil(highestPercent * 1.1 * 100) / 100, 1),
    100,
  );
}

function formatChartPercent(value: number) {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

function PeriodSignalingChart({
  currentPeriodNum,
  periods,
}: {
  currentPeriodNum: number;
  periods: MonitorPeriod[];
}) {
  const [metric, setMetric] = useState<PeriodChartMetric>("percentage");
  const sortedPeriods = chartPeriods(periods);

  if (sortedPeriods.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        No period history available for charting.
      </div>
    );
  }

  const showingPercentage = metric === "percentage";
  const maxValue = showingPercentage
    ? chartMaxSignalingPercent(sortedPeriods)
    : chartMaxSignalingCount(sortedPeriods);
  const midValue = showingPercentage
    ? Math.round((maxValue / 2) * 100) / 100
    : Math.round(maxValue / 2);
  const yTicks = Array.from(new Set([maxValue, midValue, 0]));
  const metricLabel = showingPercentage ? "Signaling %" : "Signaling blocks";
  const chartData: PeriodChartDatum[] = sortedPeriods.map((period) => ({
    ...period,
    isCurrent: period.periodNum === currentPeriodNum,
    label: String(period.periodNum),
    pctLabel: formatPercent(period.pct),
    signalingLabel: formatSignalingBlockCount(period.signalingCount),
  }));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight">
            {metricLabel} by period
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare the signaling count or rate from the period history table.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2">
            <span
              className="size-3 rounded-full border-2 border-primary bg-background"
              aria-hidden="true"
            />
            <span className="text-xs text-muted-foreground">{metricLabel}</span>
          </span>
          <span
            className="inline-flex rounded-lg bg-muted p-1"
            role="group"
            aria-label="Chart metric"
          >
            <Button
              aria-pressed={metric === "blocks"}
              onClick={() => setMetric("blocks")}
              size="xs"
              type="button"
              variant={metric === "blocks" ? "default" : "ghost"}
            >
              Blocks
            </Button>
            <Button
              aria-pressed={metric === "percentage"}
              onClick={() => setMetric("percentage")}
              size="xs"
              type="button"
              variant={metric === "percentage" ? "default" : "ghost"}
            >
              Signaling %
            </Button>
          </span>
        </div>
      </div>

      <div
        className="mt-5 overflow-x-auto"
        role="img"
        aria-label={`${metricLabel} by difficulty adjustment period. Chart maximum is ${showingPercentage ? formatChartPercent(maxValue) : formatSignalingBlockCount(maxValue)}.`}
      >
        <div className="min-w-160">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                accessibilityLayer
                data={chartData}
                margin={{ bottom: 12, left: 10, right: 18, top: 24 }}
              >
                <CartesianGrid
                  stroke="currentColor"
                  strokeOpacity={0.16}
                  vertical={false}
                />
                <XAxis
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.28 }}
                  dataKey="label"
                  height={34}
                  interval={0}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickLine={false}
                  tickMargin={10}
                />
                <YAxis
                  axisLine={{ stroke: "currentColor", strokeOpacity: 0.28 }}
                  domain={[0, maxValue]}
                  tick={{ fill: "currentColor", fontSize: 11 }}
                  tickFormatter={
                    showingPercentage ? formatChartPercent : formatNumber
                  }
                  tickLine={false}
                  ticks={yTicks}
                  width={48}
                />
                <RechartsTooltip
                  content={<PeriodChartTooltip metric={metric} />}
                  cursor={{ stroke: "var(--primary)", strokeOpacity: 0.24 }}
                />
                <Line
                  activeDot={{
                    fill: "var(--primary)",
                    r: 6,
                    stroke: "var(--background)",
                    strokeWidth: 3,
                  }}
                  dataKey={showingPercentage ? "pct" : "signalingCount"}
                  dot={{
                    fill: "var(--primary)",
                    r: 4.5,
                    stroke: "var(--background)",
                    strokeWidth: 3,
                  }}
                  isAnimationActive={false}
                  key={metric}
                  name={metricLabel}
                  stroke="var(--primary)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  type="linear"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            difficulty adjustment period
          </p>
        </div>
      </div>
    </div>
  );
}

function PeriodChartTooltip({
  active,
  metric,
  payload,
}: PeriodChartTooltipProps) {
  const datum = payload?.[0]?.payload;

  if (!active || !datum) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-lg shadow-foreground/10">
      <p className="font-medium text-popover-foreground">
        Period {datum.periodNum}
      </p>
      <p className="mt-1 font-mono text-primary">
        {metric === "percentage" ? datum.pctLabel : datum.signalingLabel}
      </p>
      <p className="mt-1 text-muted-foreground">
        {metric === "percentage" ? datum.signalingLabel : datum.pctLabel}
      </p>
    </div>
  );
}

export function MonitorHighlights() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    try {
      const nextData = await fetchMonitorData(signal);
      const cachedAt = Date.now();

      setData(nextData);
      setCacheInfo({ cachedAt, source: "network" });
      setError(null);
      writeCachedMonitorData(nextData, cachedAt);
    } catch (nextError) {
      if (
        nextError instanceof DOMException &&
        nextError.name === "AbortError"
      ) {
        return;
      }

      setError(
        nextError instanceof Error
          ? nextError.message
          : "Monitor data could not be loaded",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedMonitorData();
    let refreshInFlight = false;

    const refreshData = (signal?: AbortSignal) => {
      if (refreshInFlight) return;

      refreshInFlight = true;
      void loadData(signal).finally(() => {
        refreshInFlight = false;
      });
    };

    if (cached) {
      setData(cached.data);
      setCacheInfo({ cachedAt: cached.cachedAt, source: "cache" });
      setLoading(false);
    }

    if (!cached || isCacheStale(cached.cachedAt)) {
      refreshData(controller.signal);
    }

    const loadDataIfStale = () => {
      if (isPageVisible() && shouldRefreshCachedMonitorData()) {
        refreshData();
      }
    };

    window.addEventListener("focus", loadDataIfStale);
    document.addEventListener("visibilitychange", loadDataIfStale);

    return () => {
      controller.abort();
      window.removeEventListener("focus", loadDataIfStale);
      document.removeEventListener("visibilitychange", loadDataIfStale);
    };
  }, [loadData]);

  const stats = useMemo<MonitorHighlightStat[] | null>(() => {
    if (!data) return null;

    const blocksLeft = Math.max(data.periodEnd - data.tip, 0);
    const periodProgress = (data.totalBlocks / PERIOD_BLOCK_COUNT) * 100;
    const signalingDeficit = Math.max(
      REQUIRED_SIGNALING_BLOCKS - data.signalingCount,
      0,
    );

    return [
      {
        label: "Signal rate",
        value: formatPercent(data.pct),
        detail: `${formatNumber(data.signalingCount)} of ${formatNumber(data.totalBlocks)} blocks`,
      },
      {
        label: "Blocks left",
        value: formatNumber(blocksLeft),
        detail: `${formatEstimatedTime(blocksLeft)} in this period`,
      },
      {
        label: "Period progress",
        value: formatPercent(periodProgress),
        detail: `${formatNumber(signalingDeficit)} more signals needed`,
      },
    ];
  }, [data]);

  const lagStatus = data ? monitorLagStatus(data) : null;
  const transientStatus = !data
    ? loading
      ? "Loading live status"
      : "Monitor unavailable"
    : null;

  return (
    <section className="px-6 py-24" data-monitor-react>
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold">
          Live BIP-110 signaling
        </h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          Track current miner support, period progress, and the remaining
          signals needed for activation.
        </p>

        <Card className="border-border/50 bg-card/70 shadow-sm shadow-foreground/5 backdrop-blur">
          <CardContent className="pt-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {(lagStatus || transientStatus) && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-border/60 bg-background/70 text-xs",
                        lagStatus &&
                          "border-primary/30 bg-primary/10 text-primary",
                      )}
                    >
                      {lagStatus ?? transientStatus}
                    </Badge>
                  )}
                  {cacheInfo && (
                    <span className="text-xs text-muted-foreground">
                      Updated {formatCacheAge(cacheInfo.cachedAt)}
                    </span>
                  )}
                </div>
                {error && !data && (
                  <p className="mt-2 text-sm text-destructive">{error}</p>
                )}
              </div>

              <a
                href="/monitor"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-fit bg-background",
                )}
              >
                Full monitor
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {(stats ?? Array.from({ length: 3 })).map((stat, index) => (
                <div
                  key={stat?.label ?? index}
                  className="rounded-lg border border-border/50 bg-muted/30 p-4"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {stat?.label ?? "Loading"}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">
                    {stat?.value ?? "N/A"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stat?.detail ?? "Waiting for monitor data"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function PeriodBlockLink({
  block,
  children,
}: {
  block: number;
  children: ReactNode;
}) {
  return (
    <a
      href={`${MEMPOOL_BLOCK_URL}/${block}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {children}
      <ExternalLink className="size-3" aria-hidden="true" />
    </a>
  );
}

function SectionTitleLink({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id: string;
}) {
  return (
    <a
      href={`#${id}`}
      className={cn(
        "inline-flex w-fit rounded-sm text-current transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      {children}
    </a>
  );
}

function BlockTooltip({
  attributionState,
  block,
  mode,
}: {
  attributionState: BlockMiningAttributionState;
  block: MonitorGridBlock;
  mode: MonitorBlockGridMode;
}) {
  const knownBlock = block.kind === "known" ? block : null;
  const attribution =
    attributionState.status === "loaded" ? attributionState.attribution : null;
  const minedBy =
    attributionState.status === "idle" || attributionState.status === "loading"
      ? "Loading…"
      : attributionState.status === "unavailable"
        ? "Unavailable"
        : formatBlockMiner(attribution);
  const firstMinerSignal = isFirstMinerSignal(block);
  const violationCount =
    mode === "bip110" && knownBlock?.bip110Violations.status === "known"
      ? knownBlock.bip110Violations.count
      : null;

  return (
    <Tooltip.Popup
      className={cn(
        "z-50 w-[min(35rem,calc(100vw-2rem))] rounded-lg border px-3 py-2.5 font-mono text-xs leading-relaxed shadow-2xl",
        mode === "ursf"
          ? "ursf-tooltip"
          : "border-border bg-popover text-popover-foreground",
      )}
    >
      <dl className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Height</dt>
        <dd>{block.height}</dd>
        <dt className="text-muted-foreground">Hash</dt>
        <dd className="break-all">{knownBlock?.hash ?? "Unavailable"}</dd>
        <dt className="text-muted-foreground">Version</dt>
        <dd>{formatBlockVersion(knownBlock?.version)}</dd>
        <dt className="text-muted-foreground">Time</dt>
        <dd>{formatBlockTime(knownBlock?.time)}</dd>
        <dt className="text-muted-foreground">Txs</dt>
        <dd>{formatBlockTransactions(knownBlock?.nTx)}</dd>
        <dt className="text-muted-foreground">Miner</dt>
        <dd>{knownBlock ? minedBy : "Unavailable"}</dd>
        {violationCount !== null ? (
          <>
            <dt className="text-muted-foreground">Clean</dt>
            <dd>{violationCount === 0 ? "Yes" : "No"}</dd>
            <dt className="text-muted-foreground">Violations</dt>
            <dd>{formatNumber(violationCount)}</dd>
          </>
        ) : null}
      </dl>
      <p
        className={cn(
          "mt-3",
          mode === "bip110" && knownBlock?.signaling === true
            ? "text-primary"
            : "text-muted-foreground",
        )}
      >
        {mode === "bip110" && knownBlock?.signaling === true ? "" : "x "}
        {formatBlockStatus(block, mode)}
      </p>
      {firstMinerSignal && (
        <p className="mt-2 font-sans text-xs font-semibold text-primary">
          First-ever BIP-110 signal from {formatBlockMiner(attribution)}
        </p>
      )}
    </Tooltip.Popup>
  );
}

function blockTitle(block: MonitorGridBlock, mode: MonitorBlockGridMode) {
  const knownBlock = block.kind === "known" ? block : null;
  const violationCount =
    mode === "bip110" && knownBlock?.bip110Violations.status === "known"
      ? knownBlock.bip110Violations.count
      : null;
  const firstMinerSignal =
    knownBlock?.signaling === true &&
    knownBlock.signalingMiner.status === "identified" &&
    knownBlock.signalingMiner.firstSignal
      ? `First-ever signal from ${formatBlockMiner(knownBlock.signalingMiner.attribution)}`
      : null;

  return [
    `Height ${block.height}`,
    `Hash ${knownBlock?.hash ?? "Unavailable"}`,
    `Version ${formatBlockVersion(knownBlock?.version)}`,
    `Time ${formatBlockTime(knownBlock?.time)}`,
    `Txs ${formatBlockTransactions(knownBlock?.nTx)}`,
    violationCount === null
      ? null
      : `Clean ${violationCount === 0 ? "Yes" : "No"}`,
    violationCount === null ? null : `Violations ${violationCount}`,
    formatBlockStatus(block, mode),
    firstMinerSignal,
  ]
    .filter(Boolean)
    .join("\n");
}

function BlockTile({
  block,
  mode,
}: {
  block: MonitorGridBlock;
  mode: MonitorBlockGridMode;
}) {
  const [clientAttributionState, setClientAttributionState] =
    useState<BlockMiningAttributionState>({ status: "idle" });
  const blockHash = block.kind === "known" ? block.hash : null;
  const serverAttributionState = blockServerAttributionState(block);
  const attributionState = serverAttributionState ?? clientAttributionState;
  const signaling =
    mode === "bip110" && block.kind === "known" && block.signaling;
  const clean =
    mode === "bip110" && block.kind === "known" && isCleanMonitorBlock(block);
  const firstMinerSignal = mode === "bip110" && isFirstMinerSignal(block);

  const loadMiningAttribution = useCallback(() => {
    if (!blockHash || attributionState.status !== "idle") return;

    setClientAttributionState({ status: "loading" });
    void fetchBlockMiningAttribution(blockHash).then(
      (attribution) => {
        setClientAttributionState({ status: "loaded", attribution });
      },
      () => {
        setClientAttributionState({ status: "unavailable" });
      },
    );
  }, [attributionState.status, blockHash]);

  return (
    <Tooltip.Root
      onOpenChange={(open) => {
        if (open) loadMiningAttribution();
      }}
    >
      <Tooltip.Trigger
        delay={80}
        closeDelay={0}
        render={
          <a
            href={`${MEMPOOL_BLOCK_URL}/${block.height}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={blockTitle(block, mode)}
          />
        }
        className={cn(
          "relative flex h-12 items-center justify-center overflow-hidden rounded-md border px-2 font-mono text-sm font-semibold tracking-normal transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          mode === "ursf"
            ? "ursf-block-cell border-[var(--ursf-border)] bg-[var(--ursf-block)] text-[var(--ursf-block-text)] hover:bg-[var(--ursf-card-hover)]"
            : "border-border/60 bg-background/80 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
          signaling &&
            "bg-primary/10 text-primary shadow-[inset_0_-3px_0_var(--primary)] hover:bg-primary/15 hover:text-primary",
          clean && "border-primary/30 hover:border-primary/50",
          firstMinerSignal &&
            "bg-primary/20 text-primary ring-2 ring-primary/60 shadow-[inset_0_-3px_0_var(--primary),0_0_18px_color-mix(in_oklab,var(--primary)_45%,transparent)] hover:bg-primary/25",
        )}
      >
        {firstMinerSignal && (
          <>
            <span
              className="pointer-events-none absolute -right-2 -top-2 size-9 rounded-full bg-primary/35 blur-md motion-safe:animate-pulse"
              aria-hidden="true"
            />
            <Sparkles
              className="pointer-events-none absolute right-1 top-1 size-3 text-primary motion-safe:animate-pulse"
              aria-hidden="true"
            />
          </>
        )}
        <span className="relative z-10">{block.height}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={16}
          positionMethod="fixed"
          collisionAvoidance={{ side: "flip", align: "shift" }}
        >
          <BlockTooltip
            attributionState={attributionState}
            block={block}
            mode={mode}
          />
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function readRecentWindow(): RecentWindow {
  if (typeof window === "undefined") return DEFAULT_RECENT_WINDOW;

  return parseRecentWindow(
    new URLSearchParams(window.location.search).get(RECENT_WINDOW_PARAM),
  );
}

/**
 * Keeps the selected window in `?window=` and anchors the URL to the card, so
 * a shared link opens on the same view and scrolls to it
 */
function useRecentWindow(): [RecentWindow, (next: RecentWindow) => void] {
  const [windowSize, setWindowSize] = useState<RecentWindow>(
    DEFAULT_RECENT_WINDOW,
  );

  // the URL is only readable after hydration
  useEffect(() => {
    setWindowSize(readRecentWindow());

    const onPopState = () => setWindowSize(readRecentWindow());
    window.addEventListener("popstate", onPopState);

    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const selectWindow = useCallback((next: RecentWindow) => {
    setWindowSize(next);
    const search = recentWindowSearch(window.location.search, next);
    // replace rather than push so the back button still leaves the page, and
    // so setting the hash does not scroll the card out from under the click
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search}#${RECENT_SIGNALING_SECTION_ID}`,
    );
  }, []);

  return [windowSize, selectWindow];
}

function RecentSignalingCard({
  blockDataStatus,
  blocks,
  cacheInfo,
  data,
}: {
  blockDataStatus: BlockDataStatus;
  blocks: MonitorBlock[] | null;
  cacheInfo: CacheInfo | null;
  data: MonitorData;
}) {
  const [windowSize, selectWindow] = useRecentWindow();

  const recent = useMemo(
    () => recentSignaling(blocks ?? [], windowSize),
    [blocks, windowSize],
  );

  const unavailable = recent.sampled === 0;

  return (
    <Card
      id={RECENT_SIGNALING_SECTION_ID}
      className="scroll-mt-24 border-border/50 bg-card/50 backdrop-blur"
    >
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Recent signaling
          </p>
          <CardTitle className="mt-1 text-xl font-semibold tracking-tight">
            <SectionTitleLink id={RECENT_SIGNALING_SECTION_ID}>
              {recentWindowHeading(windowSize)}
            </SectionTitleLink>
          </CardTitle>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {blockDataStatus === "live" && (
            <Badge
              variant="outline"
              className="gap-1.5 border-primary/30 bg-primary/10 text-primary"
            >
              <span
                className="size-1.5 rounded-full bg-current animate-pulse"
                aria-hidden="true"
              />
              Live
            </Badge>
          )}
          {cacheInfo && (
            <span className="text-xs text-muted-foreground">
              Updated {formatCacheAge(cacheInfo.cachedAt)}
            </span>
          )}
          <span
            className="inline-flex rounded-lg bg-muted p-1"
            role="group"
            aria-label="Recent signaling window"
          >
            {RECENT_WINDOWS.map((size) => (
              <Button
                key={size}
                aria-label={recentWindowHeading(size)}
                aria-pressed={windowSize === size}
                onClick={() => selectWindow(size)}
                size="xs"
                type="button"
                variant={windowSize === size ? "default" : "ghost"}
              >
                {size}
              </Button>
            ))}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <p className="font-mono text-4xl font-bold tracking-tight sm:text-5xl">
          {unavailable ? "N/A" : formatPercent(recent.pct)}
        </p>
        <p className="mt-3 max-w-2xl text-sm text-foreground/80">
          {recentSignalingCounts(recent)}
        </p>
        {!unavailable && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {recentSignalingDetail(recent, data.periodNum)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PeriodBlockGrid({
  blockDataStatus,
  blocks,
  data,
  mode = "bip110",
}: {
  blockDataStatus: BlockDataStatus;
  blocks: MonitorBlock[] | null;
  data: MonitorData;
  mode?: MonitorBlockGridMode;
}) {
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setShowAll(false);
  }, [data.periodNum, data.tip, mode]);

  const gridBlocks = useMemo(
    () => mergePeriodBlocks(data, blocks),
    [blocks, data],
  );

  const visibleBlocks = showAll
    ? gridBlocks
    : gridBlocks.slice(0, MONITOR_GRID_VISIBLE_BLOCKS);
  const hiddenCount = Math.max(gridBlocks.length - visibleBlocks.length, 0);
  const hasFirstMinerSignal =
    mode === "bip110" && visibleBlocks.some(isFirstMinerSignal);
  const liveBlockCount = blocks?.length ?? 0;
  const hasLiveBlocks = liveBlockCount > 0;

  const blockDataLabel =
    blockDataStatus === "live"
      ? "Live block data"
      : blockDataStatus === "loading"
        ? "Loading block data"
        : "Block data unavailable";

  return (
    <Card
      id={BLOCK_GRID_SECTION_ID}
      className={cn(
        "scroll-mt-24 overflow-visible border-border/50 bg-card/50 backdrop-blur",
        mode === "ursf" && "ursf-card border shadow-none",
      )}
    >
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p
            className={cn(
              "text-xs font-medium uppercase tracking-wide text-muted-foreground",
              mode === "ursf" && "ursf-label",
            )}
          >
            {mode === "ursf" ? "Recent blocks" : "Current period blocks"}
          </p>
          <CardTitle
            className={cn(
              "mt-1 text-xl font-semibold tracking-tight",
              mode === "ursf" && "ursf-heading font-sans",
            )}
          >
            <SectionTitleLink
              id={BLOCK_GRID_SECTION_ID}
              className={cn(
                mode === "ursf" && "hover:text-[var(--ursf-accent)]",
              )}
            >
              {mode === "ursf" ? "All quiet" : "Block signaling grid"}
            </SectionTitleLink>
          </CardTitle>
          <p
            className={cn(
              "mt-2 max-w-2xl text-sm text-muted-foreground",
              mode === "ursf" && "ursf-muted",
            )}
          >
            Difficulty period {formatNumber(data.periodNum)}:{" "}
            {formatNumber(gridBlocks.length)} tracked blocks
            {mode === "bip110"
              ? `, ${formatNumber(data.signalingCount)} signaling`
              : ", 0 URSF signals"}
          </p>
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground",
            mode === "ursf" && "ursf-muted",
          )}
        >
          <Badge
            variant="outline"
            className={cn(
              "border-border/60 bg-background/70",
              blockDataStatus === "live" && "border-primary/25 text-primary",
              mode === "ursf" &&
                "border-[var(--ursf-border)] bg-[var(--ursf-pill)] text-[var(--ursf-muted)]",
            )}
          >
            {blockDataLabel}
          </Badge>
          <span className="inline-flex items-center gap-2">
            <span className="size-3 rounded-sm bg-primary" aria-hidden="true" />
            Signaling
          </span>
          <span className="inline-flex items-center gap-2">
            <span
              className={cn(
                "size-3 rounded-sm border border-border bg-background",
                mode === "ursf" && "ursf-block-dot border-[var(--ursf-border)]",
              )}
              aria-hidden="true"
            />
            Not signaling
          </span>
          {mode === "bip110" && (
            <>
              <span className="inline-flex items-center gap-2">
                <span
                  className="size-3 rounded-sm border border-primary/30 bg-background"
                  aria-hidden="true"
                />
                Clean
              </span>
              {hasFirstMinerSignal ? (
                <span className="inline-flex items-center gap-2">
                  <span
                    className="relative size-3 rounded-sm border border-primary bg-primary/20 ring-1 ring-primary/60"
                    aria-hidden="true"
                  >
                    <Sparkles className="absolute -right-1 -top-1 size-2.5 text-primary" />
                  </span>
                  Miner&apos;s first-ever signal
                </span>
              ) : null}
            </>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-2 sm:grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))]">
          {visibleBlocks.map((block) => (
            <BlockTile
              key={block.kind === "known" ? block.hash : block.height}
              block={block}
              mode={mode}
            />
          ))}
        </div>

        {hiddenCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAll(true)}
            className={cn(
              "mt-4 w-full bg-background",
              mode === "ursf" &&
                "ursf-link-button border-[var(--ursf-border)] bg-[var(--ursf-card)]",
            )}
          >
            Show all {formatNumber(gridBlocks.length)} blocks
          </Button>
        )}

        {!hasLiveBlocks && (
          <p
            className={cn(
              "mt-3 text-xs text-muted-foreground",
              mode === "ursf" && "ursf-muted",
            )}
          >
            Waiting for detailed block metadata.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function MonitorBlockGrid({
  mode = "bip110",
}: {
  mode?: MonitorBlockGridMode;
}) {
  const [data, setData] = useState<MonitorData | null>(null);
  const [blocks, setBlocks] = useState<MonitorBlock[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyMonitorBlocks = useCallback((payload: MonitorBlocksPayload) => {
    setBlocks(payload.blocks);
  }, []);
  const { blockDataStatus } = useMonitorBlocks(
    data?.tip ?? null,
    applyMonitorBlocks,
  );

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedMonitorData();
    let active = true;
    let refreshInFlight = false;

    const applyCachedData = (nextData: MonitorData) => {
      if (!active) return;

      setData(nextData);
      setError(null);
    };

    const applyData = (nextData: MonitorData) => {
      if (!active) return;

      const cachedAt = Date.now();
      applyCachedData(nextData);
      writeCachedMonitorData(nextData, cachedAt);
    };

    const handleError = (nextError: unknown) => {
      if (!active) return;

      if (
        nextError instanceof DOMException &&
        nextError.name === "AbortError"
      ) {
        return;
      }

      setError(
        nextError instanceof Error
          ? nextError.message
          : "Monitor data could not be loaded",
      );
    };

    const loadData = (signal?: AbortSignal) => {
      if (refreshInFlight) return;

      refreshInFlight = true;
      fetchMonitorData(signal)
        .then(applyData)
        .catch(handleError)
        .finally(() => {
          refreshInFlight = false;

          if (active) {
            setLoading(false);
          }
        });
    };

    if (cached) {
      setData(cached.data);
      setLoading(false);
    }

    if (!cached || isCacheStale(cached.cachedAt)) {
      loadData(controller.signal);
    }

    const loadDataIfStale = () => {
      if (mode === "ursf") return;
      if (!isPageVisible() || !shouldRefreshCachedMonitorData()) return;

      loadData();
    };

    const handleMonitorDataEvent = (event: Event) => {
      const detail = monitorDataEventDetail(event);
      if (!detail) return;

      applyCachedData(detail.data);
      setLoading(false);
    };

    window.addEventListener("focus", loadDataIfStale);
    document.addEventListener("visibilitychange", loadDataIfStale);
    window.addEventListener(MONITOR_DATA_EVENT, handleMonitorDataEvent);

    return () => {
      active = false;
      controller.abort();
      window.removeEventListener("focus", loadDataIfStale);
      document.removeEventListener("visibilitychange", loadDataIfStale);
      window.removeEventListener(MONITOR_DATA_EVENT, handleMonitorDataEvent);
    };
  }, [mode]);

  useEffect(() => {
    if (!data || window.location.hash !== `#${BLOCK_GRID_SECTION_ID}`) return;

    document
      .querySelector(`[data-monitor-react] #${BLOCK_GRID_SECTION_ID}`)
      ?.scrollIntoView();
  }, [data]);

  if (loading && !data) {
    return (
      <Card
        className={cn(
          "border-border/50 bg-card/50 backdrop-blur",
          mode === "ursf" && "ursf-card mt-6 border",
        )}
      >
        <CardContent className="flex min-h-40 items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
            Loading block grid
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card
        className={cn(
          "border-destructive/30 bg-destructive/5",
          mode === "ursf" && "mt-6",
        )}
      >
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            {error ?? "Block grid data could not be loaded."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={mode === "ursf" ? "mt-6" : undefined}>
      <PeriodBlockGrid
        blockDataStatus={blockDataStatus}
        blocks={blocks}
        data={data}
        mode={mode}
      />
    </div>
  );
}

export function MonitorDashboard() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [blocks, setBlocks] = useState<MonitorBlock[] | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(
    async (signal?: AbortSignal, background = false) => {
      if (!background) setRefreshing(true);
      setError(null);

      try {
        const nextData = await fetchMonitorData(signal);
        const cachedAt = Date.now();
        setData(nextData);
        setCacheInfo({ cachedAt, source: "network" });
        writeCachedMonitorData(nextData, cachedAt);
      } catch (nextError) {
        if (
          nextError instanceof DOMException &&
          nextError.name === "AbortError"
        ) {
          return;
        }

        setError(
          nextError instanceof Error
            ? nextError.message
            : "Monitor data could not be loaded",
        );
      } finally {
        setLoading(false);
        if (!background) setRefreshing(false);
      }
    },
    [],
  );

  const applyMonitorBlocks = useCallback((payload: MonitorBlocksPayload) => {
    setBlocks(payload.blocks);
  }, []);
  const { blockDataStatus, refreshBlocks } = useMonitorBlocks(
    data?.tip ?? null,
    applyMonitorBlocks,
  );

  const refreshMonitor = useCallback(() => {
    refreshBlocks();
    void loadData();
  }, [loadData, refreshBlocks]);

  const scrollToMonitorSection = useCallback(() => {
    const sectionId = window.location.hash.slice(1);

    if (
      !MONITOR_SECTION_IDS.includes(
        sectionId as (typeof MONITOR_SECTION_IDS)[number],
      )
    ) {
      return;
    }

    document
      .querySelector(`[data-monitor-react] #${sectionId}`)
      ?.scrollIntoView();
  }, []);

  useEffect(() => {
    scrollToMonitorSection();

    window.addEventListener("hashchange", scrollToMonitorSection);
    return () => {
      window.removeEventListener("hashchange", scrollToMonitorSection);
    };
  }, [data, scrollToMonitorSection]);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedMonitorData();
    let refreshInFlight = false;

    const refreshData = (signal?: AbortSignal, background = false) => {
      if (refreshInFlight) return;

      refreshInFlight = true;
      void loadData(signal, background).finally(() => {
        refreshInFlight = false;
      });
    };

    if (cached) {
      setData(cached.data);
      setCacheInfo({ cachedAt: cached.cachedAt, source: "cache" });
      setLoading(false);
    }

    if (!cached || isCacheStale(cached.cachedAt)) {
      refreshData(controller.signal);
    }

    const loadDataIfStale = () => {
      if (isPageVisible() && shouldRefreshCachedMonitorData()) {
        refreshData();
      }
    };

    const refreshTimer = window.setInterval(() => {
      if (isPageVisible()) refreshData(undefined, true);
    }, MONITOR_DATA_REFRESH_MS);

    window.addEventListener("focus", loadDataIfStale);
    document.addEventListener("visibilitychange", loadDataIfStale);

    return () => {
      controller.abort();
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", loadDataIfStale);
      document.removeEventListener("visibilitychange", loadDataIfStale);
    };
  }, [loadData]);

  const stats = useMemo(() => {
    if (!data) return null;

    const blocksLeft = Math.max(data.periodEnd - data.tip, 0);
    const periodProgress = (data.totalBlocks / PERIOD_BLOCK_COUNT) * 100;
    const activationProgress = (data.pct / ACTIVATION_THRESHOLD) * 100;
    const signalingDeficit = Math.max(
      REQUIRED_SIGNALING_BLOCKS - data.signalingCount,
      0,
    );
    const historyPeriods = monitorHistoryPeriods(data);

    return {
      blocksLeft,
      periodProgress,
      activationProgress,
      signalingDeficit,
      historyPeriods,
    };
  }, [data]);

  if (loading && !data) {
    return (
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="flex min-h-80 items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <RefreshCw className="size-5 animate-spin" aria-hidden="true" />
            Loading live monitor data
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || !stats) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 size-5 shrink-0 text-destructive"
              aria-hidden="true"
            />
            <div>
              <h2 className="font-semibold">Monitor data unavailable</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {error ?? "The public monitor API did not return data."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={MONITOR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Open source monitor
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
            <a
              href={URSF_MONITOR_URL}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              URSF Monitor
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  const lagStatus = monitorLagStatus(data);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 shadow-sm shadow-foreground/5 dark:bg-card/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {lagStatus && (
                <Badge
                  variant="outline"
                  className="gap-1.5 border-primary/30 bg-primary/10 text-primary"
                >
                  <span
                    className="size-1.5 rounded-full bg-current animate-pulse"
                    aria-hidden="true"
                  />
                  {lagStatus}
                </Badge>
              )}
              <span className="text-sm text-foreground/80">
                Updated {formatUpdatedAt(data.updatedAt)}
              </span>
              {cacheInfo && (
                <span className="text-sm text-muted-foreground">
                  Cached {formatCacheAge(cacheInfo.cachedAt)}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center">
              <span>Public BIP-{data.bip} monitor data is cached locally.</span>
              <span
                className="hidden size-1 rounded-full bg-muted-foreground/40 sm:block"
                aria-hidden="true"
              />
              <a
                href={MONITOR_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1 text-primary hover:underline"
              >
                Source monitor
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
              <a
                href={URSF_MONITOR_URL}
                className="inline-flex w-fit items-center gap-1 text-primary hover:underline"
              >
                URSF Monitor
              </a>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={refreshMonitor}
            className="self-start bg-background md:self-auto"
            disabled={refreshing}
          >
            <RefreshCw
              className={cn("size-3.5", refreshing && "animate-spin")}
              aria-hidden="true"
            />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />
          <p className="text-muted-foreground">
            Last refresh failed: {error}. Showing{" "}
            {cacheInfo?.source === "cache" ? "cached" : "latest loaded"} values.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          label="Indexed tip"
          value={formatNumber(data.tip)}
          detail="Highest block indexed by the monitor"
        />
        <StatusCard
          label="Chain tip"
          value={formatNumber(data.chainTip)}
          detail="Latest Bitcoin chain height reported"
        />
        <StatusCard
          label="Signal rate"
          value={formatPercent(data.pct)}
          detail={`Current period target is ${ACTIVATION_THRESHOLD}%`}
          tone="primary"
        />
        <StatusCard
          label="Signals"
          value={formatNumber(data.signalingCount)}
          detail={`${formatNumber(data.totalBlocks)} blocks tracked this period`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card
          id={CURRENT_PERIOD_SECTION_ID}
          className="scroll-mt-24 border-border/50 bg-card/50 backdrop-blur"
        >
          <CardHeader>
            <CardTitle>
              <SectionTitleLink id={CURRENT_PERIOD_SECTION_ID}>
                Difficulty Adjustment Period {data.periodNum}
              </SectionTitleLink>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Block range
                </p>
                <p className="mt-2 text-sm font-medium">
                  <PeriodBlockLink block={data.periodStart}>
                    {formatNumber(data.periodStart)}
                  </PeriodBlockLink>
                  <span className="mx-2 text-muted-foreground">to</span>
                  <PeriodBlockLink block={data.periodEnd}>
                    {formatNumber(data.periodEnd)}
                  </PeriodBlockLink>
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Blocks left
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatNumber(stats.blocksLeft)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatEstimatedTime(stats.blocksLeft)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Threshold
                </p>
                <p className="mt-2 text-lg font-semibold">
                  {formatNumber(REQUIRED_SIGNALING_BLOCKS)}
                </p>
                <p className="text-sm text-muted-foreground">
                  signaling blocks required
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <ProgressRow
                label="Signaling rate"
                value={formatPercent(data.pct)}
                detail={`${formatNumber(data.signalingCount)} signaling blocks, ${formatNumber(stats.signalingDeficit)} more needed for lock-in`}
                percent={stats.activationProgress}
              />
              <ProgressRow
                label="Period progress"
                value={`${formatNumber(data.totalBlocks)} / ${formatNumber(PERIOD_BLOCK_COUNT)}`}
                detail={`${formatNumber(stats.blocksLeft)} blocks remain in this period`}
                percent={stats.periodProgress}
                className="bg-foreground/70 dark:bg-foreground/80"
              />
            </div>
          </CardContent>
        </Card>

        <Card
          id={RULES_SECTION_ID}
          className="scroll-mt-24 border-border/50 bg-card/50 backdrop-blur"
        >
          <CardHeader>
            <CardTitle>
              <SectionTitleLink id={RULES_SECTION_ID}>
                BIP-110 Rules
              </SectionTitleLink>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              BIP-110 is a temporary soft fork that limits data field sizes to
              reduce blockchain bloat and refocus development on monetary use
              cases.
            </p>
            <div className="grid gap-3">
              <div className="rounded-lg border border-border/50 p-3">
                <p className="font-medium text-foreground">Signal bit</p>
                <p>Miners signal support by setting bit {SIGNAL_BIT}.</p>
              </div>
              <div className="rounded-lg border border-border/50 p-3">
                <p className="font-medium text-foreground">Activation</p>
                <p>
                  {ACTIVATION_THRESHOLD}% of blocks in one 2,016-block period
                  must signal for early lock-in.
                </p>
              </div>
              <div className="rounded-lg border border-border/50 p-3">
                <p className="font-medium text-foreground">
                  Voluntary deadline
                </p>
                <p>
                  Block {formatNumber(VOLUNTARY_DEADLINE_BLOCK)} in period{" "}
                  {VOLUNTARY_DEADLINE_PERIOD}.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card
        id={HISTORY_SECTION_ID}
        className="scroll-mt-24 border-border/50 bg-card/50 backdrop-blur"
      >
        <CardHeader>
          <CardTitle>
            <SectionTitleLink id={HISTORY_SECTION_ID}>
              Difficulty Adjustment Period History
            </SectionTitleLink>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PeriodSignalingChart
            currentPeriodNum={data.periodNum}
            periods={stats.historyPeriods}
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="border-b border-border/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-3 pl-4 pr-4 font-medium">Period</th>
                  <th className="py-3 pr-4 font-medium">First block</th>
                  <th className="py-3 pr-4 font-medium">Last block</th>
                  <th className="py-3 pr-4 font-medium">Blocks tracked</th>
                  <th className="py-3 pr-4 font-medium">Signaling</th>
                  <th className="py-3 font-medium">Signal %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats.historyPeriods.map((period) => {
                  const isCurrentPeriod = period.periodNum === data.periodNum;

                  return (
                    <tr
                      key={period.periodNum}
                      className={cn(isCurrentPeriod && "bg-primary/5")}
                    >
                      <td className="py-3 pl-4 pr-4 font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{period.periodNum}</span>
                          {isCurrentPeriod && (
                            <span className="inline-flex h-5 items-center rounded-full border border-primary/25 bg-primary/10 px-2 text-[0.7rem] font-medium leading-none text-primary">
                              Current
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <PeriodBlockLink block={period.startBlock}>
                          {formatNumber(period.startBlock)}
                        </PeriodBlockLink>
                      </td>
                      <td className="py-3 pr-4">
                        <PeriodBlockLink block={period.endBlock}>
                          {formatNumber(period.endBlock)}
                        </PeriodBlockLink>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatNumber(period.totalBlocks)} /{" "}
                        {formatNumber(PERIOD_BLOCK_COUNT)}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {formatNumber(period.signalingCount)}
                      </td>
                      <td className="py-3 font-mono text-muted-foreground">
                        {formatPercent(period.pct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <RecentSignalingCard
        blockDataStatus={blockDataStatus}
        blocks={blocks}
        cacheInfo={cacheInfo}
        data={data}
      />

      <PeriodBlockGrid
        blockDataStatus={blockDataStatus}
        blocks={blocks}
        data={data}
      />
    </div>
  );
}
