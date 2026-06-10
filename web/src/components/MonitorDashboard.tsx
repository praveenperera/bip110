import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ExternalLink, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const API_URL = "/api/monitor";
const LOCAL_DEV_API_URL = "https://bip110monitor.com/api";
const MONITOR_URL = "https://bip110monitor.com";
const URSF_MONITOR_URL = "/ursf-monitor";
const MEMPOOL_BLOCK_URL = "https://mempool.space/block";
const CACHE_KEY = "bip110-monitor-data";
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 60_000;
const REFRESH_INTERVAL_MS = 60_000;
const PERIOD_BLOCK_COUNT = 2016;
const ACTIVATION_THRESHOLD = 55;
const VOLUNTARY_DEADLINE_BLOCK = 961542;
const VOLUNTARY_DEADLINE_PERIOD = 476;
const SIGNAL_BIT = 4;
const REQUIRED_SIGNALING_BLOCKS = Math.ceil(
  PERIOD_BLOCK_COUNT * (ACTIVATION_THRESHOLD / 100),
);

type Period = {
  periodNum: number;
  startBlock: number;
  endBlock: number;
  signalingCount: number;
  totalBlocks: number;
  pct: number;
};

type MonitorData = {
  bip: string;
  tip: number;
  chainTip: number;
  periodNum: number;
  periodStart: number;
  periodEnd: number;
  totalBlocks: number;
  signalingCount: number;
  pct: number;
  synced: boolean;
  updatedAt: string;
  periods: Period[];
};

type StatusCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "primary";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPeriod(value: unknown): value is Period {
  if (!isRecord(value)) return false;

  return (
    typeof value.periodNum === "number" &&
    typeof value.startBlock === "number" &&
    typeof value.endBlock === "number" &&
    typeof value.signalingCount === "number" &&
    typeof value.totalBlocks === "number" &&
    typeof value.pct === "number"
  );
}

function isMonitorData(value: unknown): value is MonitorData {
  if (!isRecord(value)) return false;

  return (
    typeof value.bip === "string" &&
    typeof value.tip === "number" &&
    typeof value.chainTip === "number" &&
    typeof value.periodNum === "number" &&
    typeof value.periodStart === "number" &&
    typeof value.periodEnd === "number" &&
    typeof value.totalBlocks === "number" &&
    typeof value.signalingCount === "number" &&
    typeof value.pct === "number" &&
    typeof value.synced === "boolean" &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.periods) &&
    value.periods.every(isPeriod)
  );
}

function readCachedMonitorData(): CachedMonitorData | null {
  try {
    const cached = window.localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsed = JSON.parse(cached) as unknown;
    if (!isRecord(parsed)) return null;

    if (
      parsed.version !== CACHE_VERSION ||
      typeof parsed.cachedAt !== "number" ||
      !isMonitorData(parsed.data)
    ) {
      return null;
    }

    return {
      cachedAt: parsed.cachedAt,
      data: parsed.data,
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
    return (await response.json()) as MonitorData;
  }

  if (response.status === 404 && isLocalDevHost()) {
    const fallbackResponse = await fetch(LOCAL_DEV_API_URL, {
      cache: "no-store",
      signal,
    });

    if (fallbackResponse.ok) {
      return (await fallbackResponse.json()) as MonitorData;
    }

    throw new Error(`Monitor API returned ${fallbackResponse.status}`);
  }

  throw new Error(`Monitor API returned ${response.status}`);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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

function PeriodBlockLink({
  block,
  children,
}: {
  block: number;
  children: React.ReactNode;
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

export function MonitorDashboard() {
  const [data, setData] = useState<MonitorData | null>(null);
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
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
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const cached = readCachedMonitorData();
    let timeout: number | undefined;
    let interval: number | undefined;

    const startPolling = () => {
      interval = window.setInterval(() => void loadData(), REFRESH_INTERVAL_MS);
    };

    if (cached) {
      const age = Date.now() - cached.cachedAt;
      setData(cached.data);
      setCacheInfo({ cachedAt: cached.cachedAt, source: "cache" });
      setLoading(false);

      if (age < CACHE_TTL_MS) {
        timeout = window.setTimeout(() => {
          void loadData();
          startPolling();
        }, CACHE_TTL_MS - age);
      } else {
        void loadData(controller.signal);
        startPolling();
      }
    } else {
      void loadData(controller.signal);
      startPolling();
    }

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
      window.clearInterval(interval);
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
    const sortedPeriods = [...data.periods].sort(
      (a, b) => b.periodNum - a.periodNum,
    );

    return {
      blocksLeft,
      periodProgress,
      activationProgress,
      signalingDeficit,
      sortedPeriods,
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

  const syncBadge = data.synced ? "Synced" : "Syncing";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 shadow-sm shadow-foreground/5 dark:bg-card/60">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 border-primary/20 bg-primary/10 text-primary",
                  !data.synced &&
                    "border-border bg-secondary text-secondary-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full bg-current",
                    !data.synced && "animate-pulse",
                  )}
                  aria-hidden="true"
                />
                {syncBadge}
              </Badge>
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
              <span>
                Public BIP-{data.bip} monitor data refreshes every minute and
                caches locally.
              </span>
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
            onClick={() => void loadData()}
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
        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>Difficulty Adjustment Period {data.periodNum}</CardTitle>
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

        <Card className="border-border/50 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle>BIP-110 Rules</CardTitle>
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

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle>Difficulty Adjustment Period History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="border-b border-border/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-3 pr-4 font-medium">Period</th>
                  <th className="py-3 pr-4 font-medium">First block</th>
                  <th className="py-3 pr-4 font-medium">Last block</th>
                  <th className="py-3 pr-4 font-medium">Blocks tracked</th>
                  <th className="py-3 pr-4 font-medium">Signaling</th>
                  <th className="py-3 font-medium">Signal %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {stats.sortedPeriods.map((period) => (
                  <tr key={period.periodNum}>
                    <td className="py-3 pr-4 font-medium">
                      {period.periodNum}
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
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
