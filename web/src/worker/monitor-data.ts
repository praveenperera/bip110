import {
  parseMonitorData,
  type MonitorData,
  type UnclassifiedMonitorBlock,
} from "../lib/monitor.ts";
import { monitorDataFromBlocks as rescriptMonitorDataFromBlocks } from "../lib/Monitor.gen.ts";
import {
  activationThreshold as ACTIVATION_THRESHOLD,
  formatInteger,
  formatPercent,
  monitorDescription,
} from "./MonitorPresentation.gen.ts";
import { readMempoolPeriod } from "./mempool-api.ts";
import { readBip110MonitorBlocks } from "./monitor-source.ts";
import { readFirstAvailable } from "./provider-fallback.ts";
import { monitorApiPath } from "./WorkerRouter.gen.ts";

const UPSTREAM_MONITOR_API = "https://bip110monitor.com/api";
const MONITOR_REQUEST_TIMEOUT_MS = 5_000;

export const CACHE_TTL_SECONDS = 60;
export {
  ACTIVATION_THRESHOLD,
  formatInteger,
  formatPercent,
  monitorDescription,
};

type CacheStatus = "HIT" | "MISS" | "BYPASS";
type MonitorSource =
  | "bip110monitor-api"
  | "bip110monitor-page"
  | "mempool-guide"
  | "mempool-space";
type MonitorProvider = "api" | "page" | "mempool";

interface CachedMonitorResponse {
  response: Response;
  cacheStatus: CacheStatus;
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
  url.pathname = monitorApiPath;
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
  const providers = ["api", "page", "mempool"] as const;
  const result = await readFirstAvailable<
    MonitorProvider,
    {
      data: MonitorData;
      source: MonitorSource;
    }
  >(
    providers,
    async (provider) => {
      if (provider === "api") {
        return {
          data: await readUpstreamMonitorApi(),
          source: "bip110monitor-api",
        };
      }

      if (provider === "page") {
        const payload = await readBip110MonitorBlocks();

        return {
          data: monitorDataFromBlocks(payload.blocks, payload.updatedAt),
          source: "bip110monitor-page",
        };
      }

      const payload = await readMempoolPeriod();

      return {
        data: monitorDataFromBlocks(
          payload.blocks,
          payload.updatedAt,
          payload.tip,
        ),
        source: payload.provider,
      };
    },
    "Monitor data providers unavailable",
  );

  return result.value;
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
  return rescriptMonitorDataFromBlocks(
    [...blocks],
    updatedAt,
    expectedTip ?? null,
  );
}

export async function handleMonitorApiRequest(
  request: Request,
  ctx: ExecutionContext,
): Promise<Response> {
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
