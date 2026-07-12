import type { MonitorData, MonitorPeriod } from "./types";

const UPSTREAM_MONITOR_API = "https://bip110monitor.com/api";

export const MONITOR_API_PATH = "/api/monitor";
export const CACHE_TTL_SECONDS = 60;
export const PERIOD_SIZE = 2016;
export const ACTIVATION_THRESHOLD = 55;

type CacheStatus = "HIT" | "MISS" | "BYPASS";

interface CachedMonitorResponse {
  response: Response;
  cacheStatus: CacheStatus;
}

const integerFormatter = new Intl.NumberFormat("en-US");

export function formatInteger(value: number): string {
  return integerFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function monitorDescription(data: MonitorData): string {
  return [
    `BIP-110 status: ${formatPercent(data.pct)} of blocks signaling`,
    `in difficulty adjustment period ${data.periodNum}`,
    `(${formatInteger(data.signalingCount)} of ${formatInteger(data.totalBlocks)} blocks).`,
    `${ACTIVATION_THRESHOLD}% needed to activate.`,
  ].join(" ");
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function monitorCacheKey(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = MONITOR_API_PATH;
  url.search = "";

  return new Request(url.toString(), { method: "GET" });
}

export function defaultCache(): Cache {
  return (caches as CacheStorage & { readonly default: Cache }).default;
}

export async function fetchCachedMonitorResponse(
  request: Request,
  ctx: ExecutionContext,
): Promise<CachedMonitorResponse> {
  const cache = defaultCache();
  const cacheKey = monitorCacheKey(request);
  const cached = await cache.match(cacheKey);

  if (cached) {
    return {
      response: await normalizedMonitorResponse(cached),
      cacheStatus: "HIT",
    };
  }

  const upstreamResponse = await fetch(UPSTREAM_MONITOR_API, {
    headers: { accept: "application/json" },
  });

  if (!upstreamResponse.ok) {
    return {
      response: jsonResponse(
        { error: "Monitor API unavailable" },
        {
          status: upstreamResponse.status,
          headers: {
            "cache-control": "no-store",
          },
        },
      ),
      cacheStatus: "BYPASS",
    };
  }

  const response = await normalizedMonitorResponse(upstreamResponse);

  ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));

  return { response, cacheStatus: "MISS" };
}

async function normalizedMonitorResponse(
  response: Response,
): Promise<Response> {
  const data = parseMonitorData(await response.clone().json());

  return jsonResponse(data, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": `public, max-age=${CACHE_TTL_SECONDS}`,
    },
    status: response.status,
    statusText: response.statusText,
  });
}

export async function handleMonitorApiRequest(
  request: Request,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: { allow: "GET, HEAD" },
      },
    );
  }

  const { response, cacheStatus } = await fetchCachedMonitorResponse(
    request,
    ctx,
  );
  const headers = new Headers(response.headers);
  headers.set("x-bip110-cache", cacheStatus);

  return new Response(request.method === "HEAD" ? null : response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export async function readMonitorData(
  request: Request,
  ctx: ExecutionContext,
): Promise<MonitorData> {
  const { response } = await fetchCachedMonitorResponse(request, ctx);

  if (!response.ok) {
    throw new Error(`monitor API unavailable: ${response.status}`);
  }

  return parseMonitorData(await response.clone().json());
}

export function parseMonitorData(value: unknown): MonitorData {
  if (!isRecord(value)) {
    throw new Error("monitor API response must be an object");
  }

  const data = {
    bip: stringField(value, "bip"),
    tip: numberField(value, "tip"),
    chainTip: numberField(value, "chainTip"),
    periodNum: numberField(value, "periodNum"),
    periodStart: numberField(value, "periodStart"),
    periodEnd: numberField(value, "periodEnd"),
    totalBlocks: numberField(value, "totalBlocks"),
    signalingCount: numberField(value, "signalingCount"),
    pct: numberField(value, "pct"),
    periods: periodsField(value),
    synced: booleanField(value, "synced"),
    updatedAt: stringField(value, "updatedAt"),
  };

  const lockedInPct = (data.signalingCount / PERIOD_SIZE) * 100;
  const normalizedData = {
    ...data,
    pct: lockedInPct,
    periods: monitorPeriods({ ...data, pct: lockedInPct }),
  };

  if (!isReasonableMonitorData(normalizedData)) {
    throw new Error("monitor API response contains invalid values");
  }

  return normalizedData;
}

function monitorPeriods(data: MonitorData): MonitorPeriod[] {
  const currentPeriod = {
    periodNum: data.periodNum,
    startBlock: data.periodStart,
    endBlock: data.periodEnd,
    signalingCount: data.signalingCount,
    totalBlocks: data.totalBlocks,
    pct: data.pct,
  };
  const previousPeriods = data.periods
    .filter((period) => period.periodNum !== data.periodNum)
    .sort((a, b) => b.periodNum - a.periodNum);

  return [currentPeriod, ...previousPeriods];
}

export function isReasonableMonitorData(data: MonitorData): boolean {
  return (
    data.tip > 0 &&
    data.chainTip > 0 &&
    data.periodNum > 0 &&
    data.periodStart > 0 &&
    data.periodEnd >= data.periodStart &&
    data.totalBlocks >= 0 &&
    data.totalBlocks <= PERIOD_SIZE &&
    data.signalingCount >= 0 &&
    data.signalingCount <= data.totalBlocks &&
    data.pct >= 0 &&
    data.pct <= 100 &&
    data.periods.every(isReasonableMonitorPeriod) &&
    data.updatedAt.length > 0
  );
}

function isReasonableMonitorPeriod(period: MonitorPeriod): boolean {
  return (
    period.periodNum > 0 &&
    period.startBlock > 0 &&
    period.endBlock >= period.startBlock &&
    period.totalBlocks >= 0 &&
    period.totalBlocks <= PERIOD_SIZE &&
    period.signalingCount >= 0 &&
    period.signalingCount <= period.totalBlocks &&
    period.pct >= 0 &&
    period.pct <= 100
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(
  value: Record<string, unknown>,
  fieldName: string,
): string {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "string") {
    throw new Error(`monitor API field ${fieldName} must be a string`);
  }

  return fieldValue;
}

function numberField(
  value: Record<string, unknown>,
  fieldName: string,
): number {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
    throw new Error(`monitor API field ${fieldName} must be a number`);
  }

  return fieldValue;
}

function booleanField(
  value: Record<string, unknown>,
  fieldName: string,
): boolean {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "boolean") {
    throw new Error(`monitor API field ${fieldName} must be a boolean`);
  }

  return fieldValue;
}

function periodsField(value: Record<string, unknown>): MonitorPeriod[] {
  const fieldValue = value.periods;

  if (!Array.isArray(fieldValue)) {
    return [];
  }

  return fieldValue.map((period) => {
    if (!isRecord(period)) {
      throw new Error("monitor API period must be an object");
    }

    return {
      periodNum: numberField(period, "periodNum"),
      startBlock: numberField(period, "startBlock"),
      endBlock: numberField(period, "endBlock"),
      signalingCount: numberField(period, "signalingCount"),
      totalBlocks: numberField(period, "totalBlocks"),
      pct: numberField(period, "pct"),
    };
  });
}
