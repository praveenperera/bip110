import {
  PERIOD_SIZE,
  parseMonitorData,
  type MonitorData,
  type UnclassifiedMonitorBlock,
} from "../lib/monitor.ts";
import { readMempoolPeriod } from "./mempool-api.ts";
import { readBip110MonitorBlocks } from "./monitor-source.ts";

const UPSTREAM_MONITOR_API = "https://bip110monitor.com/api";
const MONITOR_REQUEST_TIMEOUT_MS = 5_000;

export const MONITOR_API_PATH = "/api/monitor";
export const CACHE_TTL_SECONDS = 60;
export const ACTIVATION_THRESHOLD = 55;

type CacheStatus = "HIT" | "MISS" | "BYPASS";
type MonitorSource =
  | "bip110monitor-api"
  | "bip110monitor-page"
  | "mempool-guide"
  | "mempool-space";

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
      response: cached,
      cacheStatus: "HIT",
    };
  }

  try {
    const { data, source } = await readMonitorDataWithFallbacks();
    const response = normalizedMonitorResponse(data, source);

    ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));

    return { response, cacheStatus: "MISS" };
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: "monitor_data_providers_failed",
      }),
    );

    return {
      response: jsonResponse(
        { error: "Monitor API unavailable" },
        {
          status: 502,
          headers: {
            "cache-control": "no-store",
          },
        },
      ),
      cacheStatus: "BYPASS",
    };
  }
}

function normalizedMonitorResponse(
  data: MonitorData,
  source: MonitorSource,
): Response {
  return jsonResponse(data, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": `public, max-age=${CACHE_TTL_SECONDS}`,
      "x-bip110-monitor-source": source,
    },
  });
}

async function readMonitorDataWithFallbacks(): Promise<{
  data: MonitorData;
  source: MonitorSource;
}> {
  try {
    return {
      data: await readUpstreamMonitorApi(),
      source: "bip110monitor-api",
    };
  } catch {}

  try {
    const payload = await readBip110MonitorBlocks();

    return {
      data: monitorDataFromBlocks(payload.blocks, payload.updatedAt),
      source: "bip110monitor-page",
    };
  } catch {}

  const payload = await readMempoolPeriod();

  return {
    data: monitorDataFromBlocks(payload.blocks, payload.updatedAt, payload.tip),
    source: payload.provider,
  };
}

async function readUpstreamMonitorApi(): Promise<MonitorData> {
  const response = await fetch(UPSTREAM_MONITOR_API, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(MONITOR_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`BIP-110 monitor API returned ${response.status}`);
  }

  return parseMonitorData(await response.json());
}

/** Builds a current-period monitor snapshot from contiguous block summaries */
export function monitorDataFromBlocks(
  blocks: readonly UnclassifiedMonitorBlock[],
  updatedAt: string,
  expectedTip?: number,
): MonitorData {
  const tip = expectedTip ?? Math.max(...blocks.map((block) => block.height));
  if (!Number.isSafeInteger(tip) || tip <= 0) {
    throw new Error("monitor fallback blocks contain no valid tip");
  }

  const periodNum = Math.floor(tip / PERIOD_SIZE);
  const periodStart = periodNum * PERIOD_SIZE;
  const periodEnd = periodStart + PERIOD_SIZE - 1;
  const periodBlocks = [...blocks]
    .filter((block) => block.height >= periodStart && block.height <= tip)
    .sort((left, right) => right.height - left.height);
  const totalBlocks = tip - periodStart + 1;

  if (
    periodBlocks.length !== totalBlocks ||
    periodBlocks.some((block, index) => block.height !== tip - index)
  ) {
    throw new Error("monitor fallback blocks do not cover the current period");
  }

  const signalingCount = periodBlocks.filter((block) => block.signaling).length;

  return parseMonitorData({
    bip: "110",
    tip,
    chainTip: tip,
    periodNum,
    periodStart,
    periodEnd,
    totalBlocks,
    signalingCount,
    pct: totalBlocks === 0 ? 0 : (signalingCount / totalBlocks) * 100,
    periods: [],
    synced: true,
    updatedAt,
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
  headers.set("cache-control", "no-store");
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
