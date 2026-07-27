import {
  MONITOR_GRID_VISIBLE_BLOCKS,
  PERIOD_SIZE,
  parseBip110BlockViolationReport,
  parseMonitorBlocksPayload,
  type Bip110BlockViolationReport,
  type Bip110ViolationStatus,
  type MonitorBlock,
  type MonitorBlocksPayload,
  type UnclassifiedMonitorBlock,
} from "../lib/monitor";
import {
  isAuthoritativeKilombinoViolationReport,
  reconstructBip110ViolationReport,
} from "./bip110-violations";
import { readMempoolBlocks, readMempoolPeriod } from "./mempool-api";
import { defaultCache, jsonResponse } from "./monitor-data";
import {
  readBip110MonitorBlocks,
  type Bip110MonitorBlocks,
} from "./monitor-source";
import { readWithBackgroundRefresh } from "./provider-fallback";
import type { SignalingBlockClassification } from "./signaling-miner-history";

const KILOMBINO_BLOCKS_API_URL = "https://mempool.kilombino.com/api/v1/blocks";
const KILOMBINO_BLOCK_API_URL = "https://mempool.kilombino.com/api/block";
const KILOMBINO_BLOCK_PAGE_SIZE = 15;
const KILOMBINO_REQUEST_TIMEOUT_MS = 3_000;
const MAX_KILOMBINO_DIRECT_REQUESTS = KILOMBINO_BLOCK_PAGE_SIZE;
const VIOLATION_CACHE_TTL_SECONDS = 31_536_000;
const VIOLATION_CACHE_VERSION = 2;
const VIOLATION_RECONSTRUCTIONS_PER_REFRESH = 1;

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
  source: string;
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

  let upstreamPayload: UnclassifiedMonitorBlocksPayload;

  try {
    upstreamPayload = await readMonitorBlocksWithFallbacks(expectedTip);
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: "monitor_block_providers_failed",
      }),
    );
    return unavailableResponse(502);
  }

  const payload = await classifiedMonitorBlocks(
    request,
    env,
    ctx,
    upstreamPayload,
  );

  const response = jsonResponse(payload, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": `public, max-age=${monitorBlocksCacheTtl(payload, expectedTip)}`,
      "x-bip110-blocks-source": upstreamPayload.source,
    },
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));

  return { response, cacheStatus: "MISS" };
}

/** Refreshes persistent signaling miner history outside user requests */
export async function refreshSignalingMinerHistory(env: Env): Promise<void> {
  const payload = await readMonitorBlocksWithFallbacks(null);

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

async function readMonitorBlocksWithFallbacks(
  expectedTip: number | null,
): Promise<UnclassifiedMonitorBlocksPayload> {
  let monitorPayload: Bip110MonitorBlocks | null = null;

  try {
    monitorPayload = await readBip110MonitorBlocks();
  } catch {}

  const monitorTip = monitorPayload
    ? Math.max(...monitorPayload.blocks.map((block) => block.height))
    : null;
  if (monitorPayload && (expectedTip === null || monitorTip === expectedTip)) {
    return {
      ...monitorPayload,
      source: "bip110monitor-page",
    };
  }

  const mempoolPayload =
    expectedTip === null
      ? await readMempoolPeriod()
      : await readMempoolBlocks(expectedTip, MONITOR_GRID_VISIBLE_BLOCKS);
  const blocks = monitorPayload
    ? mergeMonitorBlocks(monitorPayload.blocks, mempoolPayload.blocks)
    : mempoolPayload.blocks;

  return {
    blocks,
    source: monitorPayload
      ? `bip110monitor-page+${mempoolPayload.provider}`
      : mempoolPayload.provider,
    updatedAt: mempoolPayload.updatedAt,
  };
}

function mergeMonitorBlocks(
  monitorBlocks: readonly UnclassifiedMonitorBlock[],
  fallbackBlocks: readonly UnclassifiedMonitorBlock[],
): UnclassifiedMonitorBlock[] {
  const byHeight = new Map(
    monitorBlocks.map((block) => [block.height, block] as const),
  );

  for (const block of fallbackBlocks) {
    byHeight.set(block.height, block);
  }

  return [...byHeight.values()].sort(
    (left, right) => right.height - left.height,
  );
}

async function classifiedMonitorBlocks(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  payload: UnclassifiedMonitorBlocksPayload,
): Promise<MonitorBlocksPayload> {
  const [classifications, violationReports] = await Promise.all([
    classifySignalingBlocks(env, payload.blocks),
    readBip110ViolationReports(request, ctx, payload.blocks),
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

  return { blocks, updatedAt: payload.updatedAt };
}

async function readBip110ViolationReports(
  request: Request,
  ctx: ExecutionContext,
  blocks: readonly UnclassifiedMonitorBlock[],
) {
  const visibleBlocks = blocks.slice(0, MONITOR_GRID_VISIBLE_BLOCKS);

  return readWithBackgroundRefresh(
    () => readCachedViolationReports(request, visibleBlocks),
    (cachedReports) => {
      const cachedHashes = new Set(cachedReports.map((report) => report.hash));
      const missingBlocks = visibleBlocks.filter(
        (block) => !cachedHashes.has(block.hash),
      );
      if (missingBlocks.length === 0) return Promise.resolve();

      return refreshViolationReports(
        request,
        visibleBlocks,
        missingBlocks,
      ).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            event: "bip110_violation_refresh_failed",
          }),
        );
      });
    },
    (promise) => ctx.waitUntil(promise),
  );
}

async function refreshViolationReports(
  request: Request,
  visibleBlocks: readonly UnclassifiedMonitorBlock[],
  missingBlocks: readonly UnclassifiedMonitorBlock[],
): Promise<void> {
  const missingHashes = new Set(missingBlocks.map((block) => block.hash));
  const pageHeights = visibleBlocks
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

  const pageReports = pages
    .flatMap((page) => (page.status === "fulfilled" ? page.value : []))
    .filter(
      (report) =>
        missingHashes.has(report.hash) &&
        isAuthoritativeKilombinoViolationReport(report),
    );
  const reportsByHash = new Map(
    pageReports.map((report) => [report.hash, report]),
  );
  await cacheViolationReports(request, pageReports).catch(() => {});

  const missingAfterPages = missingBlocks.filter(
    (block) => !reportsByHash.has(block.hash),
  );
  const directReports = await readDirectBip110ViolationReports(
    missingAfterPages.slice(0, MAX_KILOMBINO_DIRECT_REQUESTS),
  ).then((reports) => reports.filter(isAuthoritativeKilombinoViolationReport));

  for (const report of directReports) {
    reportsByHash.set(report.hash, report);
  }
  await cacheViolationReports(request, directReports).catch(() => {});

  const missingAfterDirect = missingAfterPages.filter(
    (block) => !reportsByHash.has(block.hash),
  );
  await reconstructViolationReports(
    request,
    missingAfterDirect.slice(0, VIOLATION_RECONSTRUCTIONS_PER_REFRESH),
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

async function readDirectBip110ViolationReports(
  blocks: readonly UnclassifiedMonitorBlock[],
) {
  const reports = await Promise.allSettled(
    blocks.map(async (block) => {
      const response = await fetch(`${KILOMBINO_BLOCK_API_URL}/${block.hash}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(KILOMBINO_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(
          `Kilombino block API returned ${response.status} for ${block.hash}`,
        );
      }

      const report = parseBip110BlockViolationReport(await response.json());
      if (report.hash !== block.hash || report.height !== block.height) {
        throw new Error(
          "Kilombino direct block response did not match request",
        );
      }

      return report;
    }),
  );

  return reports.flatMap((report) =>
    report.status === "fulfilled" ? [report.value] : [],
  );
}

async function readCachedViolationReports(
  request: Request,
  blocks: readonly UnclassifiedMonitorBlock[],
) {
  const cache = defaultCache();
  const reports = await Promise.all(
    blocks.map(async (block) => {
      const response = await cache.match(
        violationCacheKey(request, block.hash),
      );
      if (!response) return null;

      try {
        const report = parseBip110BlockViolationReport(await response.json());
        return report.hash === block.hash && report.height === block.height
          ? report
          : null;
      } catch {
        return null;
      }
    }),
  );

  return reports.filter((report) => report !== null);
}

async function reconstructViolationReports(
  request: Request,
  blocks: readonly UnclassifiedMonitorBlock[],
): Promise<void> {
  await Promise.all(
    blocks.map((block) =>
      reconstructBip110ViolationReport(block)
        .then((report) => cacheViolationReports(request, [report]))
        .catch((error: unknown) => {
          console.error(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              event: "bip110_violation_reconstruction_failed",
              hash: block.hash,
              height: block.height,
            }),
          );
        }),
    ),
  );
}

async function cacheViolationReports(
  request: Request,
  reports: readonly Bip110BlockViolationReport[],
): Promise<void> {
  const cache = defaultCache();

  await Promise.all(
    reports.map((report) =>
      cache.put(
        violationCacheKey(request, report.hash),
        jsonResponse(
          {
            id: report.hash,
            height: report.height,
            extras: {
              bip110ViolationCount: report.violations.count,
            },
          },
          {
            headers: {
              "cache-control": `public, max-age=${VIOLATION_CACHE_TTL_SECONDS}, immutable`,
            },
          },
        ),
      ),
    ),
  );
}

function violationCacheKey(request: Request, hash: string): Request {
  const url = new URL(request.url);
  url.pathname = `/_cache/bip110-violations/v${VIOLATION_CACHE_VERSION}/${hash}`;
  url.search = "";

  return new Request(url.toString(), { method: "GET" });
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
