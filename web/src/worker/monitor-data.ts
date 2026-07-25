import { parseMonitorData, type MonitorData } from "../lib/monitor";

const UPSTREAM_MONITOR_API = "https://bip110monitor.com/api";

export const MONITOR_API_PATH = "/api/monitor";
export const CACHE_TTL_SECONDS = 60;
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
