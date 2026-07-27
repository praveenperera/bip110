import {
  MONITOR_GRID_VISIBLE_BLOCKS,
  parseBip110BlockViolationReport,
  parseMonitorBlocksPayload,
  type Bip110BlockViolationReport,
  type MonitorBlocksPayload,
  type UnclassifiedMonitorBlock,
} from "../lib/monitor";
import { reconstructBip110ViolationReport } from "./bip110-violations";
import {
  parsePositiveHeight,
  readMempoolBlocks,
  readMempoolPeriod,
} from "./mempool-api";
import { defaultCache, jsonResponse } from "./monitor-data";
import {
  readBip110MonitorBlocks,
  type Bip110MonitorBlocks,
} from "./monitor-source";
import {
  cacheTtl as selectMonitorBlocksCacheTtl,
  classifyBlocks,
  mergeBlocks,
  signalingPlan,
} from "./MonitorBlocksModel.gen.ts";
import type { signalingBlockClassification as SignalingBlockClassification } from "./SignalingMinerHistoryModel.gen.ts";
import {
  groupBlocksByPeriod,
  maxDirectRequests,
  missingBlocks,
  monitorReport,
  reconstructionsPerRefresh,
  selectAuthoritativeReports,
  storedReports,
  violationPageHeights,
} from "./ViolationStoreModel.gen.ts";
import { monitorBlocksApiPath } from "./WorkerRouter.gen.ts";

const KILOMBINO_BLOCKS_API_URL = "https://mempool.kilombino.com/api/v1/blocks";
const KILOMBINO_BLOCK_API_URL = "https://mempool.kilombino.com/api/block";
const KILOMBINO_REQUEST_TIMEOUT_MS = 3_000;

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

  const payload = await classifiedMonitorBlocks(env, ctx, upstreamPayload);

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
  url.pathname = monitorBlocksApiPath;
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
  return value ? (parsePositiveHeight(value) ?? null) : null;
}

function monitorBlocksCacheTtl(
  payload: MonitorBlocksPayload,
  expectedTip: number | null,
): number {
  return selectMonitorBlocksCacheTtl(
    payload.blocks,
    expectedTip,
    MONITOR_BLOCKS_CACHE_TTL_SECONDS,
    MONITOR_BLOCKS_CATCH_UP_CACHE_TTL_SECONDS,
  );
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
    ? mergeBlocks(monitorPayload.blocks, mempoolPayload.blocks)
    : mempoolPayload.blocks;

  return {
    blocks,
    source: monitorPayload
      ? `bip110monitor-page+${mempoolPayload.provider}`
      : mempoolPayload.provider,
    updatedAt: mempoolPayload.updatedAt,
  };
}

async function classifiedMonitorBlocks(
  env: Env,
  ctx: ExecutionContext,
  payload: UnclassifiedMonitorBlocksPayload,
): Promise<MonitorBlocksPayload> {
  const [classifications, violationReports] = await Promise.all([
    classifySignalingBlocks(env, payload.blocks),
    readBip110ViolationReports(env, ctx, payload.blocks),
  ]);

  return classifyBlocks(
    payload.blocks,
    classifications,
    violationReports,
    payload.updatedAt,
  ) as MonitorBlocksPayload;
}

async function readBip110ViolationReports(
  env: Env,
  ctx: ExecutionContext,
  blocks: readonly UnclassifiedMonitorBlock[],
) {
  const visibleBlocks = blocks.slice(0, MONITOR_GRID_VISIBLE_BLOCKS);
  const refreshes: Promise<void>[] = [];
  const reports = await Promise.all(
    groupBlocksByPeriod(visibleBlocks, (block) => block.height).map(
      async ({ blocks: periodBlocks, periodStart }) => {
        try {
          const snapshot = await violationStore(env, periodStart).readAndClaim(
            periodStart,
            periodBlocks,
          );
          if (snapshot.refresh.status === "claimed") {
            const missingPeriodBlocks = missingBlocks(
              periodBlocks,
              snapshot.reports,
              (block) => block.hash,
            );
            refreshes.push(
              refreshViolationReports(
                env,
                periodStart,
                snapshot.refresh.token,
                periodBlocks,
                missingPeriodBlocks,
              ),
            );
          }

          return snapshot.reports.map(monitorReport);
        } catch (error) {
          console.error(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              event: "bip110_violation_store_failed",
              periodStart,
            }),
          );
          return [];
        }
      },
    ),
  );

  if (refreshes.length > 0) {
    ctx.waitUntil(
      Promise.all(refreshes).then(
        () => undefined,
        (error: unknown) => {
          console.error(
            JSON.stringify({
              error: error instanceof Error ? error.message : String(error),
              event: "bip110_violation_refresh_failed",
            }),
          );
        },
      ),
    );
  }

  return reports.flat();
}

async function refreshViolationReports(
  env: Env,
  periodStart: number,
  token: string,
  visibleBlocks: readonly UnclassifiedMonitorBlock[],
  missingBlocks: readonly UnclassifiedMonitorBlock[],
): Promise<void> {
  try {
    await refreshClaimedViolationReports(
      env,
      periodStart,
      visibleBlocks,
      missingBlocks,
    );
  } finally {
    await violationStore(env, periodStart)
      .finishRefresh(token)
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            event: "bip110_violation_refresh_release_failed",
            periodStart,
          }),
        );
      });
  }
}

async function refreshClaimedViolationReports(
  env: Env,
  periodStart: number,
  visibleBlocks: readonly UnclassifiedMonitorBlock[],
  missingBlocks: readonly UnclassifiedMonitorBlock[],
): Promise<void> {
  const pageHeights = violationPageHeights([...visibleBlocks]);
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

  const pageSelection = selectAuthoritativeReports(
    [...missingBlocks],
    pages.flatMap((page) => (page.status === "fulfilled" ? page.value : [])),
  );
  await persistViolationReports(env, periodStart, pageSelection.reports);

  const directCandidates = await readDirectBip110ViolationReports(
    pageSelection.remainingBlocks.slice(0, maxDirectRequests),
  );
  const directSelection = selectAuthoritativeReports(
    pageSelection.remainingBlocks,
    directCandidates,
  );
  await persistViolationReports(env, periodStart, directSelection.reports);

  await reconstructViolationReports(
    env,
    periodStart,
    directSelection.remainingBlocks.slice(0, reconstructionsPerRefresh),
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

async function reconstructViolationReports(
  env: Env,
  periodStart: number,
  blocks: readonly UnclassifiedMonitorBlock[],
): Promise<void> {
  await Promise.all(
    blocks.map((block) =>
      reconstructBip110ViolationReport(block)
        .then((report) => persistViolationReports(env, periodStart, [report]))
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

async function persistViolationReports(
  env: Env,
  periodStart: number,
  reports: readonly Bip110BlockViolationReport[],
): Promise<void> {
  if (reports.length === 0) return;

  await violationStore(env, periodStart).putReports(
    periodStart,
    storedReports([...reports]),
  );
}

function violationStore(env: Env, periodStart: number) {
  return env.BIP110_VIOLATIONS.getByName(periodStart.toString());
}

async function classifySignalingBlocks(
  env: Env,
  blocks: readonly UnclassifiedMonitorBlock[],
): Promise<SignalingBlockClassification[]> {
  const plan = signalingPlan([...blocks]);
  if (!plan) return [];

  try {
    return await env.SIGNALING_MINER_HISTORY.getByName("bip110").classify(
      plan.periodStart,
      plan.blocks,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
        event: "signaling_miner_classification_failed",
        periodStart: plan.periodStart,
      }),
    );

    return [];
  }
}
