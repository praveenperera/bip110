import {
  MONITOR_GRID_VISIBLE_BLOCKS,
  PERIOD_SIZE,
  parseBip110BlockViolationReport,
  parseMonitorBlocksPayload,
  type Bip110ViolationStatus,
  type MonitorBlock,
  type MonitorBlocksPayload,
  type UnclassifiedMonitorBlock,
} from "../lib/monitor";
import { defaultCache, jsonResponse } from "./monitor-data";
import type { SignalingBlockClassification } from "./signaling-miner-history";

const UPSTREAM_MONITOR_PAGE = "https://bip110monitor.com";
const KILOMBINO_BLOCKS_API_URL = "https://mempool.kilombino.com/api/v1/blocks";
const KILOMBINO_BLOCK_PAGE_SIZE = 15;
const KILOMBINO_REQUEST_TIMEOUT_MS = 3_000;
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

interface UnclassifiedMonitorBlocksPayload {
  blocks: UnclassifiedMonitorBlock[];
  updatedAt: string;
}

export async function handleMonitorBlocksApiRequest(
  request: Request,
  env: Env,
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
    env,
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
  env: Env,
  ctx: ExecutionContext,
  expectedTip?: number,
): Promise<MonitorBlocksPayload> {
  const { response } = await fetchCachedMonitorBlocksResponse(
    monitorBlocksRequest(request, expectedTip),
    env,
    ctx,
  );

  if (!response.ok) {
    throw new Error(`monitor block data unavailable: ${response.status}`);
  }

  return parseMonitorBlocksPayload(await response.clone().json());
}

async function fetchCachedMonitorBlocksResponse(
  request: Request,
  env: Env,
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

  const upstreamPayload = parseMonitorBlocksHtml(html);
  if (upstreamPayload.blocks.length === 0) {
    return unavailableResponse(502);
  }
  const payload = await classifiedMonitorBlocks(env, upstreamPayload);

  const response = jsonResponse(payload, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": `public, max-age=${monitorBlocksCacheTtl(payload, expectedTip)}`,
    },
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));

  return { response, cacheStatus: "MISS" };
}

/** Refreshes persistent signaling miner history outside user requests */
export async function refreshSignalingMinerHistory(env: Env): Promise<void> {
  const response = await fetch(UPSTREAM_MONITOR_PAGE, {
    headers: { accept: "text/html" },
  });
  if (!response.ok) {
    throw new Error(`monitor block history refresh failed: ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (
    contentLength &&
    Number.parseInt(contentLength, 10) > MAX_MONITOR_HTML_BYTES
  ) {
    throw new Error("monitor block history refresh exceeded size limit");
  }

  const html = await response.text();
  if (html.length > MAX_MONITOR_HTML_BYTES) {
    throw new Error("monitor block history refresh exceeded size limit");
  }

  const payload = parseMonitorBlocksHtml(html);
  if (payload.blocks.length === 0) {
    throw new Error("monitor block history refresh returned no blocks");
  }

  await classifySignalingBlocks(env, payload.blocks);
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

function parseMonitorBlocksHtml(
  html: string,
): UnclassifiedMonitorBlocksPayload {
  const blocks: UnclassifiedMonitorBlock[] = [];

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

async function classifiedMonitorBlocks(
  env: Env,
  payload: UnclassifiedMonitorBlocksPayload,
): Promise<MonitorBlocksPayload> {
  const [classifications, violationReports] = await Promise.all([
    classifySignalingBlocks(env, payload.blocks),
    readBip110ViolationReports(payload.blocks),
  ]);
  const classificationsByHash = new Map(
    classifications.map((classification) => [
      classification.hash,
      classification.discovery,
    ]),
  );
  const violationsByHash = new Map(
    violationReports.map((report) => [report.hash, report.violations]),
  );
  const blocks: MonitorBlock[] = payload.blocks.map((block) => {
    const bip110Violations: Bip110ViolationStatus = violationsByHash.get(
      block.hash,
    ) ?? { status: "unavailable" };

    return block.signaling
      ? ({
          ...block,
          bip110Violations,
          signaling: true,
          signalingMiner: classificationsByHash.get(block.hash) ?? {
            status: "unavailable",
          },
        } satisfies MonitorBlock)
      : {
          ...block,
          bip110Violations,
          signaling: false,
          signalingMiner: null,
        };
  });

  return { ...payload, blocks };
}

async function readBip110ViolationReports(
  blocks: readonly UnclassifiedMonitorBlock[],
) {
  const pageHeights = blocks
    .slice(0, MONITOR_GRID_VISIBLE_BLOCKS)
    .filter((_, index) => index % KILOMBINO_BLOCK_PAGE_SIZE === 0)
    .map((block) => block.height);
  const pages = await Promise.allSettled(
    pageHeights.map(readBip110ViolationPage),
  );
  const failedPageCount = pages.filter(
    (page) => page.status === "rejected",
  ).length;

  if (failedPageCount > 0) {
    console.error(
      JSON.stringify({
        event: "bip110_violation_classification_failed",
        failedPageCount,
        requestedPageCount: pageHeights.length,
      }),
    );
  }

  return pages.flatMap((page) =>
    page.status === "fulfilled" ? page.value : [],
  );
}

async function readBip110ViolationPage(startHeight: number) {
  const response = await fetch(`${KILOMBINO_BLOCKS_API_URL}/${startHeight}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(KILOMBINO_REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `Kilombino block API returned ${response.status} for height ${startHeight}`,
    );
  }

  const value: unknown = await response.json();
  if (!Array.isArray(value)) {
    throw new Error("Kilombino block API response must be an array");
  }

  const reports = value.flatMap((block) => {
    try {
      return [parseBip110BlockViolationReport(block)];
    } catch {
      return [];
    }
  });

  if (value.length > 0 && reports.length === 0) {
    throw new Error("Kilombino block API returned no valid blocks");
  }

  return reports;
}

async function classifySignalingBlocks(
  env: Env,
  blocks: readonly UnclassifiedMonitorBlock[],
): Promise<SignalingBlockClassification[]> {
  const signalingBlocks = blocks
    .filter((block) => block.signaling)
    .map(({ hash, height }) => ({ hash, height }));
  if (signalingBlocks.length === 0) return [];

  const highestBlock = blocks[0];
  if (!highestBlock) return [];

  const periodStart =
    Math.floor(highestBlock.height / PERIOD_SIZE) * PERIOD_SIZE;

  try {
    return await env.SIGNALING_MINER_HISTORY.getByName("bip110").classify(
      periodStart,
      signalingBlocks,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: "signaling_miner_classification_failed",
        periodStart,
      }),
    );

    return [];
  }
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
