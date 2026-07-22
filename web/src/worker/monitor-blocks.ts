import { defaultCache, jsonResponse } from "./monitor-data";
import type { MonitorBlock, MonitorBlocksPayload } from "./types";

const UPSTREAM_MONITOR_PAGE = "https://bip110monitor.com";
const MAX_MONITOR_HTML_BYTES = 1_000_000;
const BLOCK_TILE_PATTERN =
  /<div class="block-tile\s+(sig|nosig)(?:\s+[^"]*)?"\s+data-height="(\d+)"\s+data-hash="([0-9a-fA-F]{64})"\s+data-version="0x([0-9a-fA-F]+)"\s+data-time="([^"]+)"\s+data-ntx="(\d+)">/g;
const UPDATED_AT_PATTERN = /Updated:\s*([0-9-]+\s+[0-9:]+\s+UTC)/;

export const MONITOR_BLOCKS_API_PATH = "/api/monitor-blocks";
export const MONITOR_BLOCKS_CACHE_TTL_SECONDS = 60;
const MONITOR_BLOCKS_CATCH_UP_CACHE_TTL_SECONDS = 5;

type CacheStatus = "HIT" | "MISS" | "BYPASS";

interface CachedMonitorBlocksResponse {
  response: Response;
  cacheStatus: CacheStatus;
}

export async function handleMonitorBlocksApiRequest(
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

  const { response, cacheStatus } = await fetchCachedMonitorBlocksResponse(
    request,
    ctx,
  );
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
  headers.set("x-bip110-blocks-cache", cacheStatus);

  return new Response(request.method === "HEAD" ? null : response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

export async function readMonitorBlocks(
  request: Request,
  ctx: ExecutionContext,
  expectedTip?: number,
): Promise<MonitorBlocksPayload> {
  const { response } = await fetchCachedMonitorBlocksResponse(
    monitorBlocksRequest(request, expectedTip),
    ctx,
  );

  if (!response.ok) {
    throw new Error(`monitor block data unavailable: ${response.status}`);
  }

  return (await response.clone().json()) as MonitorBlocksPayload;
}

async function fetchCachedMonitorBlocksResponse(
  request: Request,
  ctx: ExecutionContext,
): Promise<CachedMonitorBlocksResponse> {
  const cache = defaultCache();
  const cacheKey = monitorBlocksCacheKey(request);
  const expectedTip = monitorBlocksExpectedTip(request);
  const cached = await cache.match(cacheKey);

  if (cached) {
    return { response: cached, cacheStatus: "HIT" };
  }

  const upstreamResponse = await fetch(UPSTREAM_MONITOR_PAGE, {
    headers: { accept: "text/html" },
  });

  if (!upstreamResponse.ok) {
    return unavailableResponse(upstreamResponse.status);
  }

  const contentLength = upstreamResponse.headers.get("content-length");
  if (
    contentLength &&
    Number.parseInt(contentLength, 10) > MAX_MONITOR_HTML_BYTES
  ) {
    return unavailableResponse(502);
  }

  const html = await upstreamResponse.text();
  if (html.length > MAX_MONITOR_HTML_BYTES) {
    return unavailableResponse(502);
  }

  const payload = parseMonitorBlocksHtml(html);
  if (payload.blocks.length === 0) {
    return unavailableResponse(502);
  }

  const response = jsonResponse(payload, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": `public, max-age=${monitorBlocksCacheTtl(payload, expectedTip)}`,
    },
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));

  return { response, cacheStatus: "MISS" };
}

function monitorBlocksCacheKey(request: Request): Request {
  const url = new URL(request.url);
  url.pathname = MONITOR_BLOCKS_API_PATH;
  const expectedTip = monitorBlocksExpectedTip(request);
  url.search = expectedTip === null ? "" : `?tip=${expectedTip}`;

  return new Request(url.toString(), { method: "GET" });
}

function monitorBlocksRequest(request: Request, expectedTip?: number): Request {
  if (!expectedTip) return request;

  const url = new URL(request.url);
  url.searchParams.set("tip", expectedTip.toString());

  return new Request(url.toString(), { method: "GET" });
}

function monitorBlocksExpectedTip(request: Request): number | null {
  const value = new URL(request.url).searchParams.get("tip");
  if (!value || !/^\d+$/.test(value)) return null;

  const tip = Number.parseInt(value, 10);
  return Number.isSafeInteger(tip) && tip > 0 ? tip : null;
}

function monitorBlocksCacheTtl(
  payload: MonitorBlocksPayload,
  expectedTip: number | null,
): number {
  if (expectedTip === null || payload.blocks[0]?.height === expectedTip) {
    return MONITOR_BLOCKS_CACHE_TTL_SECONDS;
  }

  return MONITOR_BLOCKS_CATCH_UP_CACHE_TTL_SECONDS;
}

function unavailableResponse(status: number): CachedMonitorBlocksResponse {
  return {
    response: jsonResponse(
      { error: "Monitor block data unavailable" },
      {
        status,
        headers: {
          "cache-control": "no-store",
        },
      },
    ),
    cacheStatus: "BYPASS",
  };
}

function parseMonitorBlocksHtml(html: string): MonitorBlocksPayload {
  const blocks: MonitorBlock[] = [];

  for (const match of html.matchAll(BLOCK_TILE_PATTERN)) {
    const [, status, height, hash, version, time, nTx] = match;
    const parsedTime = parseMonitorUtcTime(time);

    if (!parsedTime) continue;

    blocks.push({
      hash,
      height: Number.parseInt(height, 10),
      nTx: Number.parseInt(nTx, 10),
      signaling: status === "sig",
      time: parsedTime,
      version: Number.parseInt(version, 16),
    });
  }

  return {
    blocks,
    updatedAt: parseUpdatedAt(html) ?? new Date().toISOString(),
  };
}

function parseUpdatedAt(html: string): string | null {
  const match = html.match(UPDATED_AT_PATTERN);
  if (!match) return null;

  const timestamp = parseMonitorUtcTime(match[1]);
  if (!timestamp) return null;

  return new Date(timestamp * 1000).toISOString();
}

function parseMonitorUtcTime(value: string): number | null {
  const milliseconds = Date.parse(
    value.trim().replace(" UTC", "Z").replace(" ", "T"),
  );

  if (Number.isNaN(milliseconds)) {
    return null;
  }

  return Math.floor(milliseconds / 1000);
}
