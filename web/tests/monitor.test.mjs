import assert from "node:assert/strict";
import test from "node:test";

import {
  currentPeriodGrid,
  isCleanMonitorBlock,
  isFirstMinerSignal,
  parseBip110BlockViolationReport,
  parseBlockMiningAttribution,
  parseMonitorBlocksPayload,
  parseMonitorData,
  signalingMinerId,
} from "../src/lib/monitor.ts";
import {
  mandatorySignalingHeight as MANDATORY_SIGNALING_HEIGHT,
  mandatorySignalingEstimate,
  mandatorySignalingExpectedAt,
  shouldShowMandatorySignaling,
} from "../src/lib/MandatorySignaling.res.js";
import {
  initial as initialThemePreference,
  storageValue as themeStorageValue,
  systemChanged as themeSystemChanged,
  toggle as toggleThemePreference,
} from "../src/lib/ThemePreference.res.js";
import {
  decodeHash,
  make as makeFaqAnchors,
  resolveHash,
} from "../src/lib/FaqAnchors.res.js";
import {
  parseRecentWindow,
  recentSignaling,
  recentWindowSearch,
} from "../src/lib/RecentSignaling.res.js";
import {
  bip110TransactionViolations,
  countBip110ViolatingTransactions,
  isAuthoritativeKilombinoViolationReport,
} from "../src/worker/bip110-violations.ts";
import {
  ascendingPageStarts,
  descendingPageStarts,
  isBip110SignalingVersion,
  mapConcurrent,
  parseMempoolBlock,
  parsePositiveHeight,
  selectBlockRange,
  validateTransactionRequest,
} from "../src/worker/mempool-api.ts";
import {
  formatInteger,
  formatPercent,
  monitorDataFromBlocks,
  monitorDescription,
} from "../src/worker/monitor-data.ts";
import { parseBip110MonitorHtml } from "../src/worker/monitor-source.ts";
import {
  ProvidersUnavailableError,
  readFirstAvailable,
  readWithBackgroundRefresh,
} from "../src/worker/provider-fallback.ts";
import {
  groupBlocksByPeriod,
  isRefreshToken,
  missingBlocks,
  monitorReport,
  periodStart as violationPeriodStart,
  selectAuthoritativeReports,
  storedReports,
  validateBlocks as validateViolationBlocks,
  validateReports as validateViolationReports,
  violationPageHeights,
} from "../src/worker/ViolationStoreModel.res.js";
import {
  blockMinerLabel,
  dashboardBlockPresentation,
} from "../src/worker/BlockGrid.res.js";
import {
  classifications as signalingClassifications,
  discoveryBatches,
  historicalFirstSignals,
  historicalSignalingMinerId,
  missingBlocks as missingSignalingBlocks,
  schemaUpgrade as signalingSchemaUpgrade,
  shouldRetryUnresolved,
  validatedSignalingBlocks,
} from "../src/worker/SignalingMinerHistoryModel.res.js";
import {
  cacheTtl as monitorBlocksCacheTtl,
  classifyBlocks as classifyMonitorBlocks,
  mergeBlocks as mergeMonitorBlocks,
  signalingPlan as monitorBlocksSignalingPlan,
} from "../src/worker/MonitorBlocksModel.res.js";
import {
  hasImageParams as hasMonitorImageParams,
  parseImageData as parseMonitorImageData,
  renderPlan as monitorImageRenderPlan,
} from "../src/worker/MonitorOgImageModel.res.js";
import { fromExtracted as monitorBlocksFromExtracted } from "../src/worker/MonitorSourceModel.res.js";
import {
  historyTableRowsHtml as ursfHistoryTableRowsHtml,
  monitorFields as ursfMonitorFields,
  periodChartHtml as ursfPeriodChartHtml,
  periodProgressPercent as ursfPeriodProgressPercent,
} from "../src/worker/UrsfPageModel.res.js";
import {
  dashboardStats,
  formatCacheAge,
  highlightStats,
  isMonitorSectionId,
  mandatorySignalingModel,
  monitorLagStatus,
  periodChartModel,
  requiredSignalingBlocks,
} from "../src/components/MonitorDashboardModel.res.js";
import { decodeCachedMonitorData } from "../src/components/MonitorDashboardClient.res.js";
import {
  requestMethod as workerRequestMethod,
  route as workerRoute,
} from "../src/worker/WorkerRouter.res.js";
import { handleMonitorPageRequest } from "../src/worker/monitor-page.ts";
import { handleUrsfMonitorPageRequest } from "../src/worker/ursf-monitor-page.ts";

function monitorSnapshot(overrides = {}) {
  return {
    bip: "110",
    tip: 961_058,
    chainTip: 961_058,
    periodNum: 476,
    periodStart: 961_056,
    periodEnd: 963_071,
    totalBlocks: 3,
    signalingCount: 2,
    pct: 66.67,
    periods: [],
    synced: true,
    updatedAt: "2026-07-25T12:00:00.000Z",
    ...overrides,
  };
}

test("Worker routing keeps application paths closed and explicit", () => {
  assert.equal(workerRoute("/api/monitor"), "monitorApi");
  assert.equal(workerRoute("/api/monitor-blocks"), "monitorBlocksApi");
  assert.equal(workerRoute("/monitor"), "monitorPage");
  assert.equal(workerRoute("/monitor/"), "monitorPage");
  assert.equal(workerRoute("/og/monitor.png"), "monitorOgImage");
  assert.equal(workerRoute("/monitor-og.png"), "assets");
  assert.equal(workerRoute("/ursf-monitor"), "ursfMonitorPage");
  assert.equal(workerRoute("/ursf-monitor/"), "ursfMonitorPage");
  assert.equal(workerRoute("/monitoring"), "assets");
  assert.equal(workerRoute("/"), "assets");
  assert.equal(workerRequestMethod("GET"), "get");
  assert.equal(workerRequestMethod("HEAD"), "head");
  assert.equal(workerRequestMethod("POST"), "unsupported");
  assert.equal(workerRequestMethod("get"), "unsupported");
});

test("monitor page shells do not wait for live data APIs", async () => {
  const originalCaches = globalThis.caches;
  const originalFetch = globalThis.fetch;
  const assetPaths = [];
  let cacheReads = 0;
  let networkRequests = 0;

  globalThis.caches = {
    default: {
      async match() {
        cacheReads += 1;
        return undefined;
      },
    },
  };
  globalThis.fetch = async () => {
    networkRequests += 1;
    throw new Error("live APIs must not run while serving page HTML");
  };

  const env = {
    ASSETS: {
      async fetch(request) {
        assetPaths.push(new URL(request.url).pathname);
        return new Response("<!doctype html><title>Monitor</title>", {
          headers: {
            "content-type": "text/html; charset=utf-8",
            etag: '"asset"',
          },
        });
      },
    },
  };
  const ctx = {
    waitUntil() {
      assert.fail("page responses must not start background API work");
    },
  };

  try {
    const monitorResponse = await handleMonitorPageRequest(
      new Request("https://bip110.example/monitor?window=72"),
      env,
      ctx,
    );
    const ursfResponse = await handleUrsfMonitorPageRequest(
      new Request("https://bip110.example/ursf-monitor"),
      env,
      ctx,
    );

    assert.deepEqual(assetPaths, ["/monitor/", "/ursf-monitor/"]);
    assert.equal(cacheReads, 0);
    assert.equal(networkRequests, 0);
    assert.equal(monitorResponse.headers.get("x-bip110-monitor-og"), "static");
    assert.equal(ursfResponse.headers.get("x-bip110-ursf-monitor"), "static");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) {
      delete globalThis.caches;
    } else {
      globalThis.caches = originalCaches;
    }
  }
});

function decodedTransaction({
  prevoutScript = `0014${"11".repeat(20)}`,
  scriptSig = "",
  txid = "a".repeat(64),
  witness = [],
  outputScript = `0014${"22".repeat(20)}`,
} = {}) {
  return {
    txid,
    vin: [
      {
        is_coinbase: false,
        prevout: {
          scriptpubkey: prevoutScript,
        },
        scriptsig: scriptSig,
        witness,
      },
    ],
    vout: [
      {
        scriptpubkey: outputScript,
      },
    ],
  };
}

test("FAQ anchors remain unique and accept legacy deep links", () => {
  const items = makeFaqAnchors([
    { question: "Same question?", answer: "First" },
    { question: "Same question!", answer: "Second" },
    { question: "?!", answer: "Fallback" },
  ]);

  assert.deepEqual(
    items.map(({ canonicalId, legacyId }) => ({ canonicalId, legacyId })),
    [
      { canonicalId: "same-question", legacyId: "q1" },
      { canonicalId: "same-question-2", legacyId: "q2" },
      { canonicalId: "question-3", legacyId: "q3" },
    ],
  );
  assert.equal(resolveHash(items, "#q2")?.canonicalId, "same-question-2");
  assert.equal(resolveHash(items, "#same-question")?.answer, "First");
  assert.equal(resolveHash(items, "#missing") == null, true);
  assert.equal(decodeHash("#%E0%A4%A"), "%E0%A4%A");
});

test("system-derived themes follow the system until the user toggles", () => {
  const system = initialThemePreference(null, true);

  assert.deepEqual(system, { theme: "dark", source: "system" });
  assert.equal(themeStorageValue(system), null);
  assert.deepEqual(themeSystemChanged(system, false), {
    theme: "light",
    source: "system",
  });

  const explicit = toggleThemePreference(system);
  assert.deepEqual(explicit, { theme: "light", source: "explicit" });
  assert.equal(themeStorageValue(explicit), "light");
  assert.deepEqual(themeSystemChanged(explicit, true), explicit);
  assert.deepEqual(initialThemePreference("dark", false), {
    theme: "dark",
    source: "explicit",
  });
});

test("mandatory signaling estimate tracks the target block boundary", () => {
  assert.deepEqual(
    mandatorySignalingEstimate(MANDATORY_SIGNALING_HEIGHT - 1, 61),
    {
      status: "pending",
      blocksRemaining: 1,
      countdown: {
        days: 0,
        hours: 0,
        minutes: 8,
        seconds: 59,
      },
    },
  );
  assert.deepEqual(mandatorySignalingEstimate(MANDATORY_SIGNALING_HEIGHT), {
    status: "reached",
    blocksRemaining: 0,
    countdown: {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    },
  });
  assert.equal(
    shouldShowMandatorySignaling(MANDATORY_SIGNALING_HEIGHT - 1),
    true,
  );
  assert.equal(shouldShowMandatorySignaling(MANDATORY_SIGNALING_HEIGHT), false);
  assert.equal(
    shouldShowMandatorySignaling(MANDATORY_SIGNALING_HEIGHT + 1),
    false,
  );
});

test("mandatory signaling expected time is anchored to the observed tip", () => {
  const observedAt = Date.parse("2026-07-25T12:00:00.000Z");

  assert.equal(
    mandatorySignalingExpectedAt(MANDATORY_SIGNALING_HEIGHT - 2, observedAt),
    Date.parse("2026-07-25T12:20:00.000Z"),
  );
  assert.equal(
    mandatorySignalingExpectedAt(MANDATORY_SIGNALING_HEIGHT, observedAt),
    null,
  );
  assert.equal(
    mandatorySignalingExpectedAt(MANDATORY_SIGNALING_HEIGHT - 1, Number.NaN),
    null,
  );
});

test("recent signaling uses the newest supported window", () => {
  const recent = recentSignaling(
    [
      { height: 8, signaling: false },
      { height: 10, signaling: true },
      { height: 9, signaling: true },
    ],
    48,
  );

  assert.deepEqual(recent, {
    window: 48,
    sampled: 3,
    signaling: 2,
    pct: (2 / 3) * 100,
    partial: true,
  });
});

test("recent window URLs preserve unrelated query parameters", () => {
  assert.equal(parseRecentWindow("72"), 72);
  assert.equal(parseRecentWindow("12"), 48);
  assert.equal(parseRecentWindow(null), 48);
  assert.equal(
    recentWindowSearch("?source=share&window=72", 48),
    "?source=share",
  );
  assert.equal(
    recentWindowSearch("?source=share", 144),
    "?source=share&window=144",
  );
});

test("monitor snapshots have one canonical current period", () => {
  const input = monitorSnapshot({
    periods: [
      {
        periodNum: 474,
        startBlock: 957_024,
        endBlock: 959_039,
        signalingCount: 300,
        totalBlocks: 2_016,
        pct: 14.88,
      },
      {
        periodNum: 476,
        startBlock: 1,
        endBlock: 2,
        signalingCount: 0,
        totalBlocks: 1,
        pct: 0,
      },
      {
        periodNum: 475,
        startBlock: 959_040,
        endBlock: 961_055,
        signalingCount: 500,
        totalBlocks: 2_016,
        pct: 24.8,
      },
    ],
  });

  const parsed = parseMonitorData(input);

  assert.deepEqual(
    parsed.periods.map((period) => period.periodNum),
    [476, 475, 474],
  );
  assert.deepEqual(parsed.periods[0], {
    periodNum: 476,
    startBlock: 961_056,
    endBlock: 963_071,
    signalingCount: 2,
    totalBlocks: 3,
    pct: 66.67,
  });
});

test("monitor presentation keeps stable public number formatting", () => {
  assert.equal(formatInteger(12_345), "12,345");
  assert.equal(formatPercent(55), "55.00%");
  assert.equal(
    monitorDescription(
      monitorSnapshot({
        periodNum: 476,
        signalingCount: 2,
        totalBlocks: 3,
        pct: 66.666,
      }),
    ),
    "BIP-110 status: 66.67% of blocks signaling in difficulty adjustment period 476 (2 of 3 blocks). 55% needed to activate.",
  );
});

test("dashboard summaries use one current period and explicit cache time", () => {
  const data = monitorSnapshot({
    periods: [
      {
        periodNum: 475,
        startBlock: 959_040,
        endBlock: 961_055,
        signalingCount: 12,
        totalBlocks: 2_016,
        pct: 0.6,
      },
      {
        periodNum: 476,
        startBlock: 961_056,
        endBlock: 963_071,
        signalingCount: 999,
        totalBlocks: 2_016,
        pct: 49.55,
      },
    ],
  });
  const stats = dashboardStats(data);

  assert.equal(requiredSignalingBlocks, 1_109);
  assert.equal(stats.blocksLeft, 2_013);
  assert.equal(stats.signalingDeficit, 1_107);
  assert.deepEqual(
    stats.historyPeriods.map((period) => period.periodNum),
    [476, 475],
  );
  assert.deepEqual(highlightStats(data), [
    {
      label: "Signal rate",
      value: "66.67%",
      detail: "2 of 3 blocks",
    },
    {
      label: "Blocks left",
      value: "2,013",
      detail: "~14 days in this period",
    },
    {
      label: "Period progress",
      value: "0.15%",
      detail: "1,107 more signals needed",
    },
  ]);
  assert.equal(formatCacheAge(1_000, 5_999), "just now");
  assert.equal(formatCacheAge(1_000, 61_000), "1m ago");
});

test("dashboard chart and mandatory countdown models are deterministic", () => {
  const data = monitorSnapshot({
    periods: [
      {
        periodNum: 475,
        startBlock: 959_040,
        endBlock: 961_055,
        signalingCount: 12,
        totalBlocks: 2_016,
        pct: 0.6,
      },
    ],
  });
  const chart = periodChartModel(
    dashboardStats(data).historyPeriods,
    data.periodNum,
    "percentage",
  );
  const countdown = mandatorySignalingModel(
    data,
    Date.parse(data.updatedAt) + 1_000,
  );

  assert.deepEqual(
    chart.data.map((point) => point.periodNum),
    [475, 476],
  );
  assert.equal(chart.data[1].isCurrent, true);
  assert.equal(chart.metricLabel, "Signaling %");
  assert.equal(chart.maximumLabel, "73.34%");
  assert.equal(countdown.target, "961,632");
  assert.equal(countdown.blocksRemaining, 574);
  assert.deepEqual(
    countdown.units.map((unit) => unit.displayValue),
    ["03", "23", "39", "59"],
  );
});

test("dashboard status and section targets preserve synchronization semantics", () => {
  assert.equal(monitorLagStatus(monitorSnapshot()), null);
  assert.equal(
    monitorLagStatus(monitorSnapshot({ synced: false })),
    "Monitor index catching up",
  );
  assert.equal(
    monitorLagStatus(monitorSnapshot({ chainTip: 961_060, synced: false })),
    "Monitor lagging by 2 blocks",
  );
  assert.equal(isMonitorSectionId("recent-signaling"), true);
  assert.equal(isMonitorSectionId("not-a-monitor-section"), false);
});

test("dashboard cache entries validate version, time, and monitor data", () => {
  const data = monitorSnapshot();

  assert.deepEqual(
    decodeCachedMonitorData({
      cachedAt: 1_785_175_200_000,
      data,
      version: 2,
    }),
    {
      cachedAt: 1_785_175_200_000,
      data: parseMonitorData(data),
    },
  );
  assert.equal(
    decodeCachedMonitorData({
      cachedAt: -1,
      data,
      version: 2,
    }),
    null,
  );
  assert.equal(
    decodeCachedMonitorData({
      cachedAt: 1_785_175_200_000,
      data,
      version: 1,
    }),
    null,
  );
});

test("URSF page model consistently renders zero-signaling history", () => {
  const data = monitorSnapshot({
    periods: [
      {
        periodNum: 475,
        startBlock: 959_040,
        endBlock: 961_055,
        signalingCount: 20,
        totalBlocks: 2_016,
        pct: 0.99,
      },
    ],
  });
  const fields = ursfMonitorFields(data);
  const rows = ursfHistoryTableRowsHtml(data);
  const chart = ursfPeriodChartHtml(data);

  assert.equal(fields["history-previous-period"], "475");
  assert.equal(fields["history-previous-tracked"], "2,016 / 2,016");
  assert.equal(ursfPeriodProgressPercent(data), (3 / 2_016) * 100);
  assert.match(rows, /ursf-current-period/);
  assert.equal((rows.match(/0\.00%/g) ?? []).length, 2);
  assert.match(chart, /URSF blocks by period/);
  assert.match(chart, /Period 475: 0 signaling blocks \(0\.00%\)/);
  assert.match(chart, />current<\/text>/);
});

test("monitor snapshots reject signaling counts beyond tracked blocks", () => {
  assert.throws(
    () =>
      parseMonitorData(
        monitorSnapshot({
          signalingCount: 4,
        }),
      ),
    /invalid values/,
  );
});

test("monitor block payloads are parsed at runtime", () => {
  const payload = parseMonitorBlocksPayload({
    blocks: [
      {
        bip110Violations: {
          status: "known",
          count: 0,
        },
        hash: "a".repeat(64),
        height: 961_058,
        nTx: 2_345,
        signaling: true,
        signalingMiner: {
          status: "identified",
          attribution: {
            poolName: "OCEAN",
            poolSlug: "ocean",
            templateMinerName: "Roughnecks",
          },
          firstSignal: false,
        },
        time: 1_774_441_200,
        version: 0x20000010,
      },
    ],
    updatedAt: "2026-07-25T12:00:00.000Z",
  });

  assert.equal(payload.blocks[0].height, 961_058);
  assert.deepEqual(payload.blocks[0].bip110Violations, {
    status: "known",
    count: 0,
  });
  assert.deepEqual(payload.blocks[0].signalingMiner, {
    status: "identified",
    attribution: {
      poolName: "OCEAN",
      poolSlug: "ocean",
      templateMinerName: "Roughnecks",
    },
    firstSignal: false,
  });
  assert.throws(
    () => parseMonitorBlocksPayload({ blocks: [{}], updatedAt: "now" }),
    /field hash must be a string/,
  );
});

test("BIP-110 cleanliness is derived from zero violations", () => {
  const cleanReport = parseBip110BlockViolationReport({
    id: "c".repeat(64),
    height: 961_058,
    extras: {
      bip110ViolationCount: 0,
    },
  });
  const violatingReport = parseBip110BlockViolationReport({
    id: "d".repeat(64),
    height: 961_057,
    extras: {
      bip110ViolationCount: 3,
    },
  });
  const monitorBlock = {
    bip110Violations: cleanReport.violations,
    hash: cleanReport.hash,
    height: cleanReport.height,
    nTx: 1_234,
    signaling: false,
    signalingMiner: null,
    time: 1_774_441_200,
    version: 0x20000000,
  };

  assert.equal(isCleanMonitorBlock(monitorBlock), true);
  assert.equal(
    isCleanMonitorBlock({
      ...monitorBlock,
      bip110Violations: violatingReport.violations,
    }),
    false,
  );
  assert.equal(
    isCleanMonitorBlock({
      ...monitorBlock,
      bip110Violations: { status: "unavailable" },
    }),
    false,
  );
  assert.throws(
    () =>
      parseBip110BlockViolationReport({
        id: "e".repeat(64),
        height: 961_056,
        extras: {
          bip110ViolationCount: -1,
        },
      }),
    /non-negative integer/,
  );
});

test("Kilombino zero counts remain unverified until reconstruction", () => {
  const zeroReport = parseBip110BlockViolationReport({
    id: "e".repeat(64),
    height: 961_056,
    extras: {
      bip110ViolationCount: 0,
    },
  });
  const positiveReport = parseBip110BlockViolationReport({
    id: "f".repeat(64),
    height: 961_055,
    extras: {
      bip110ViolationCount: 1,
    },
  });

  assert.equal(isAuthoritativeKilombinoViolationReport(zeroReport), false);
  assert.equal(isAuthoritativeKilombinoViolationReport(positiveReport), true);
});

test("violation reports persist by difficulty period without zero sentinels", () => {
  const priorPeriodBlock = { hash: "a".repeat(64), height: 959_615 };
  const currentPeriodBlock = { hash: "b".repeat(64), height: 959_616 };
  const groups = groupBlocksByPeriod(
    [currentPeriodBlock, priorPeriodBlock],
    (block) => block.height,
  );

  assert.deepEqual(groups, [
    {
      periodStart: 959_616,
      blocks: [currentPeriodBlock],
    },
    {
      periodStart: 957_600,
      blocks: [priorPeriodBlock],
    },
  ]);

  const verifiedZero = {
    ...currentPeriodBlock,
    count: 0,
  };
  assert.deepEqual(
    missingBlocks([currentPeriodBlock], [verifiedZero], (block) => block.hash),
    [],
  );
  assert.deepEqual(monitorReport(verifiedZero), {
    hash: currentPeriodBlock.hash,
    height: currentPeriodBlock.height,
    violations: { status: "known", count: 0 },
  });
});

test("violation refresh policy advances only authoritative matching reports", () => {
  const blocks = Array.from({ length: 17 }, (_, index) => ({
    hash: index.toString(16).padStart(64, "0"),
    height: 961_072 - index,
    nTx: 10,
    time: 1_774_441_200 - index,
    version: 0x2000_0010,
  }));
  const positive = parseBip110BlockViolationReport({
    id: blocks[0].hash,
    height: blocks[0].height,
    extras: { bip110ViolationCount: 2 },
  });
  const zero = parseBip110BlockViolationReport({
    id: blocks[1].hash,
    height: blocks[1].height,
    extras: { bip110ViolationCount: 0 },
  });
  const unrelated = parseBip110BlockViolationReport({
    id: "f".repeat(64),
    height: blocks[2].height,
    extras: { bip110ViolationCount: 3 },
  });
  const selection = selectAuthoritativeReports(blocks, [
    positive,
    zero,
    unrelated,
  ]);

  assert.deepEqual(violationPageHeights(blocks), [
    blocks[0].height,
    blocks[15].height,
  ]);
  assert.deepEqual(selection.reports, [positive]);
  assert.deepEqual(selection.remainingBlocks, blocks.slice(1));
  assert.deepEqual(storedReports(selection.reports), [
    {
      count: 2,
      hash: blocks[0].hash,
      height: blocks[0].height,
    },
  ]);
});

test("violation store requests enforce period, identity, and count invariants", () => {
  const first = { hash: "a".repeat(64), height: 959_616 };
  const second = { hash: "b".repeat(64), height: 959_617 };
  const largeHeight = 3_000_000_000;
  const largePeriodStart = violationPeriodStart(largeHeight);

  assert.equal(violationPeriodStart(second.height), 959_616);
  assert.equal(largePeriodStart > 2_147_483_647, true);
  assert.deepEqual(
    validateViolationBlocks(largePeriodStart, [
      { hash: "c".repeat(64), height: largeHeight },
    ]),
    [{ hash: "c".repeat(64), height: largeHeight }],
  );
  assert.deepEqual(validateViolationBlocks(959_616, [first, second]), [
    second,
    first,
  ]);
  assert.deepEqual(
    validateViolationReports(959_616, [{ ...second, count: 0 }]),
    [{ ...second, count: 0 }],
  );
  assert.throws(
    () => validateViolationBlocks(959_616, [first, first]),
    /contains duplicates/,
  );
  assert.throws(
    () => validateViolationReports(959_616, [{ ...second, count: -1 }]),
    /non-negative integer/,
  );
  assert.throws(
    () => validateViolationBlocks(959_616, [{ ...first, hash: "invalid" }]),
    /hash is invalid/,
  );
  assert.throws(
    () => validateViolationBlocks(959_616, [{ ...first, height: 957_600 }]),
    /outside its difficulty period/,
  );
  assert.equal(isRefreshToken("12345678-1234-4123-8123-123456789abc"), true);
  assert.equal(isRefreshToken("12345678-1234-1123-8123-123456789abc"), false);
});

test("first miner signals require an identified signaling block", () => {
  const block = {
    bip110Violations: { status: "known", count: 0 },
    hash: "f".repeat(64),
    height: 961_058,
    kind: "known",
    nTx: 1_234,
    signaling: true,
    signalingMiner: {
      status: "identified",
      attribution: {
        poolName: "OCEAN",
        poolSlug: "ocean",
        templateMinerName: "Roughnecks",
      },
      firstSignal: true,
    },
    time: 1_774_441_200,
    version: 0x20000010,
  };

  assert.equal(isFirstMinerSignal(block), true);
  assert.equal(
    isFirstMinerSignal({
      ...block,
      signalingMiner: {
        ...block.signalingMiner,
        firstSignal: false,
      },
    }),
    false,
  );
});

test("block mining attribution identifies the pool", () => {
  assert.deepEqual(
    parseBlockMiningAttribution({
      extras: {
        pool: {
          name: "Foundry USA",
          minerNames: null,
        },
      },
    }),
    {
      poolName: "Foundry USA",
      poolSlug: null,
      templateMinerName: null,
    },
  );
});

test("OCEAN block attribution identifies the template miner", () => {
  assert.deepEqual(
    parseBlockMiningAttribution({
      extras: {
        pool: {
          name: "OCEAN",
          minerNames: [" OCEANXYZ ", " Roughnecks "],
        },
      },
    }),
    {
      poolName: "OCEAN",
      poolSlug: null,
      templateMinerName: "Roughnecks",
    },
  );
});

test("signaling miner identities distinguish OCEAN template makers", () => {
  assert.equal(
    signalingMinerId({
      poolName: "OCEAN",
      poolSlug: "ocean",
      templateMinerName: " Roughnecks ",
    }),
    "ocean:roughnecks",
  );
  assert.equal(
    signalingMinerId({
      poolName: "OCEAN",
      poolSlug: "ocean",
      templateMinerName: "SoV",
    }),
    "ocean:sov",
  );
  assert.equal(
    signalingMinerId({
      poolName: "OCEAN",
      poolSlug: "ocean",
      templateMinerName: null,
    }),
    null,
  );
});

test("block mining attribution tolerates unavailable pool metadata", () => {
  assert.equal(parseBlockMiningAttribution({ extras: {} }), null);
  assert.throws(
    () => parseBlockMiningAttribution("invalid"),
    /block explorer response must be an object/,
  );
});

test("current-period grids distinguish known blocks from placeholders", () => {
  const data = parseMonitorData(monitorSnapshot());
  const block = {
    bip110Violations: {
      status: "known",
      count: 0,
    },
    hash: "b".repeat(64),
    height: 961_058,
    nTx: 1_234,
    signaling: true,
    signalingMiner: {
      status: "identified",
      attribution: {
        poolName: "OCEAN",
        poolSlug: "ocean",
        templateMinerName: "Roughnecks",
      },
      firstSignal: false,
    },
    time: 1_774_441_200,
    version: 0x20000010,
  };

  assert.deepEqual(currentPeriodGrid(data, [block]), [
    { ...block, kind: "known" },
    { height: 961_057, kind: "placeholder" },
    { height: 961_056, kind: "placeholder" },
  ]);
});

test("dashboard block presentation keeps tooltip and accessibility labels consistent", () => {
  const block = {
    bip110Violations: { status: "known", count: 0 },
    hash: "b".repeat(64),
    height: 961_058,
    kind: "known",
    nTx: 1_234,
    signaling: true,
    signalingMiner: {
      status: "identified",
      attribution: {
        poolName: "OCEAN",
        poolSlug: "ocean",
        templateMinerName: "Roughnecks",
      },
      firstSignal: true,
    },
    time: 1_774_441_200,
    version: 0x20000010,
  };
  const presentation = dashboardBlockPresentation(block, "bip110");

  assert.equal(presentation.known, true);
  assert.equal(presentation.signaling, true);
  assert.equal(presentation.clean, true);
  assert.equal(presentation.firstMinerSignal, true);
  assert.equal(presentation.versionLabel, "0x20000010");
  assert.equal(presentation.timeLabel, "2026-03-25 12:20 UTC");
  assert.equal(presentation.transactionsLabel, "1,234");
  assert.equal(presentation.statusPrefix, "");
  assert.equal(presentation.statusLabel, "SIGNALING BIP-110");
  assert.equal(presentation.cleanLabel, "Yes");
  assert.equal(presentation.violationCountLabel, "0");
  assert.equal(presentation.hasServerAttribution, true);
  assert.deepEqual(presentation.serverAttribution, {
    poolName: "OCEAN",
    poolSlug: "ocean",
    templateMinerName: "Roughnecks",
  });
  assert.match(
    presentation.title,
    /First-ever signal from OCEAN \(Roughnecks\)/,
  );
  assert.equal(blockMinerLabel(null), "Unknown");
  assert.equal(
    blockMinerLabel({
      poolName: "OCEAN",
      poolSlug: "ocean",
      templateMinerName: "Roughnecks",
    }),
    "OCEAN (Roughnecks)",
  );

  const ursf = dashboardBlockPresentation(block, "ursf");
  assert.equal(ursf.signaling, false);
  assert.equal(ursf.violationCount == null, true);
  assert.equal(ursf.statusPrefix, "x ");
  assert.equal(ursf.statusLabel, "not signaling");
});

test("provider fallbacks use the first successful provider", async () => {
  const attempts = [];
  const result = await readFirstAvailable(
    ["primary", "secondary"],
    async (provider) => {
      attempts.push(provider);
      if (provider === "primary") throw new Error("offline");

      return 42;
    },
    "providers unavailable",
  );

  assert.deepEqual(attempts, ["primary", "secondary"]);
  assert.deepEqual(result, { provider: "secondary", value: 42 });
});

test("provider fallbacks preserve every failure cause", async () => {
  const failures = [new Error("primary"), new Error("secondary")];

  await assert.rejects(
    () =>
      readFirstAvailable(
        ["primary", "secondary"],
        async (provider) => {
          throw failures[provider === "primary" ? 0 : 1];
        },
        "providers unavailable",
      ),
    (error) => {
      assert.equal(error.name, "ProvidersUnavailableError");
      assert.equal(error.message, "providers unavailable");
      assert.deepEqual(error.causes, failures);
      assert.equal(error instanceof ProvidersUnavailableError, true);
      return true;
    },
  );
});

test("background provider refreshes do not block cached values", async () => {
  let finishRefresh;
  const refresh = new Promise((resolve) => {
    finishRefresh = resolve;
  });
  const read = readWithBackgroundRefresh(
    async () => 42,
    async () => refresh,
    () => {},
  );
  const outcome = await Promise.race([
    read.then((value) => ({ status: "returned", value })),
    new Promise((resolve) =>
      setTimeout(() => resolve({ status: "blocked" }), 25),
    ),
  ]);

  assert.deepEqual(outcome, { status: "returned", value: 42 });
  finishRefresh();
  await refresh;
});

test("signaling history validates, deduplicates, and orders block references", () => {
  const first = { hash: "a".repeat(64), height: 4_034 };
  const second = { hash: "b".repeat(64), height: 4_033 };

  assert.deepEqual(
    validatedSignalingBlocks(4_032, [first, second, { ...first }]),
    [second, first],
  );
  assert.throws(
    () =>
      validatedSignalingBlocks(4_032, [
        first,
        { hash: first.hash, height: first.height + 1 },
      ]),
    /signaling block reference is invalid/,
  );
  assert.throws(
    () => validatedSignalingBlocks(4_032.5, []),
    /signaling period start is invalid/,
  );
});

test("signaling history bounds discovery work and unresolved retries", () => {
  const blocks = Array.from({ length: 45 }, (_, index) => ({
    hash: index.toString(16).padStart(64, "0"),
    height: 4_032 + index,
  }));

  assert.deepEqual(
    discoveryBatches(blocks).map((batch) => batch.length),
    [8, 8, 8, 8, 8],
  );
  assert.equal(shouldRetryUnresolved(1_000, 3_600_999), false);
  assert.equal(shouldRetryUnresolved(1_000, 3_601_000), true);
});

test("signaling history joins stored and discovered state in block order", () => {
  const blocks = [
    { hash: "a".repeat(64), height: 4_032 },
    { hash: "b".repeat(64), height: 4_033 },
    { hash: "c".repeat(64), height: 4_034 },
  ];
  const stored = [
    {
      discovery: {
        status: "identified",
        attribution: {
          poolName: "OCEAN",
          poolSlug: "ocean",
          templateMinerName: "Roughnecks",
        },
        firstSignal: true,
      },
      hash: blocks[0].hash,
    },
  ];
  const discovered = [
    {
      discovery: { status: "unidentified" },
      hash: blocks[1].hash,
    },
  ];

  assert.deepEqual(missingSignalingBlocks(blocks, stored), blocks.slice(1));
  assert.deepEqual(signalingClassifications(blocks, stored, discovered), [
    stored[0],
    discovered[0],
    {
      discovery: { status: "unavailable" },
      hash: blocks[2].hash,
    },
  ]);
});

test("signaling history upgrades persisted schemas idempotently", () => {
  assert.equal(
    signalingSchemaUpgrade(1, ["hash", "height", "status"]),
    "addCheckedAt",
  );
  assert.equal(
    signalingSchemaUpgrade(1, ["hash", "checked_at"]),
    "rebuildLegacy",
  );
  assert.equal(
    signalingSchemaUpgrade(1, ["hash", "status", "checked_at"]),
    "recordVersion3",
  );
  assert.equal(
    signalingSchemaUpgrade(3, ["hash", "status", "checked_at"]),
    "current",
  );
});

test("historical signaling seeds have stable unique miner identities", () => {
  const identities = historicalFirstSignals.map(historicalSignalingMinerId);

  assert.equal(historicalFirstSignals.length, 15);
  assert.equal(new Set(identities).size, identities.length);
  assert.equal(
    identities.every((identity) => identity.startsWith("ocean:")),
    true,
  );
});

test("monitor block providers merge by height with fallback precedence", () => {
  const monitorBlock = {
    hash: "a".repeat(64),
    height: 4_034,
    nTx: 10,
    signaling: false,
    time: 1_785_170_000,
    version: 0x2000_0000,
  };
  const fallbackReplacement = {
    ...monitorBlock,
    hash: "b".repeat(64),
    nTx: 20,
  };
  const fallbackTip = {
    ...monitorBlock,
    hash: "c".repeat(64),
    height: 4_035,
  };

  assert.deepEqual(
    mergeMonitorBlocks([monitorBlock], [fallbackReplacement, fallbackTip]),
    [fallbackTip, fallbackReplacement],
  );
});

test("monitor block classification joins reports and preserves unavailable states", () => {
  const signalingBlock = {
    hash: "d".repeat(64),
    height: 4_035,
    nTx: 30,
    signaling: true,
    time: 1_785_170_600,
    version: 0x2000_0010,
  };
  const ordinaryBlock = {
    hash: "e".repeat(64),
    height: 4_034,
    nTx: 20,
    signaling: false,
    time: 1_785_170_000,
    version: 0x2000_0000,
  };

  assert.deepEqual(
    classifyMonitorBlocks(
      [signalingBlock, ordinaryBlock],
      [
        {
          hash: signalingBlock.hash,
          discovery: {
            status: "identified",
            attribution: {
              poolName: "Example Pool",
              poolSlug: "example",
              templateMinerName: null,
            },
            firstSignal: true,
          },
        },
        {
          hash: ordinaryBlock.hash,
          discovery: { status: "unidentified" },
        },
      ],
      [
        {
          hash: signalingBlock.hash,
          height: signalingBlock.height,
          violations: { status: "known", count: 0 },
        },
      ],
      "2026-07-27T12:00:00.000Z",
    ),
    {
      blocks: [
        {
          ...signalingBlock,
          bip110Violations: { status: "known", count: 0 },
          signalingMiner: {
            status: "identified",
            attribution: {
              poolName: "Example Pool",
              poolSlug: "example",
              templateMinerName: null,
            },
            firstSignal: true,
          },
        },
        {
          ...ordinaryBlock,
          bip110Violations: { status: "unavailable" },
          signalingMiner: null,
        },
      ],
      updatedAt: "2026-07-27T12:00:00.000Z",
    },
  );
});

test("monitor block cache and signaling plans follow current-tip policy", () => {
  const blocks = [
    {
      hash: "f".repeat(64),
      height: 4_035,
      nTx: 30,
      signaling: true,
      time: 1_785_170_600,
      version: 0x2000_0010,
    },
    {
      hash: "0".repeat(64),
      height: 4_034,
      nTx: 20,
      signaling: false,
      time: 1_785_170_000,
      version: 0x2000_0000,
    },
  ];
  const classified = classifyMonitorBlocks(
    blocks,
    [],
    [],
    "2026-07-27T12:00:00.000Z",
  );

  assert.equal(monitorBlocksCacheTtl(classified.blocks, null, 60, 5), 60);
  assert.equal(monitorBlocksCacheTtl(classified.blocks, 4_035, 60, 5), 60);
  assert.equal(monitorBlocksCacheTtl(classified.blocks, 4_036, 60, 5), 5);
  assert.deepEqual(monitorBlocksSignalingPlan(blocks), {
    periodStart: 4_032,
    blocks: [{ hash: blocks[0].hash, height: 4_035 }],
  });
  assert.equal(monitorBlocksSignalingPlan([]), null);
  assert.equal(monitorBlocksSignalingPlan([blocks[1]]), null);
});

test("monitor image parameters and geometry are validated in one model", () => {
  const params = {
    period: "476",
    tip: "960000",
    blocks: "1008",
    signals: "126",
    pct: "12.5",
    updated: "2026-07-27T12:00:00.000Z",
  };
  const data = parseMonitorImageData(params);

  assert.equal(hasMonitorImageParams(params), true);
  assert.deepEqual(data, {
    bip: "110",
    tip: 960000,
    chainTip: 960000,
    periodNum: 476,
    periodStart: 959616,
    periodEnd: 961631,
    totalBlocks: 1008,
    signalingCount: 126,
    pct: 12.5,
    periods: [],
    synced: true,
    updatedAt: "2026-07-27T12:00:00.000Z",
  });
  assert.deepEqual(monitorImageRenderPlan(data), {
    signalWidth: 123,
    thresholdX: 649,
    periodProgressWidth: 490,
    periodProgressLabel: "PERIOD PROGRESS 50%",
    pctLabel: "12.50%",
    periodLabel: "PERIOD 476",
    blocksLabel: "126 OF 1,008 BLOCKS",
    tipLabel: "INDEXED TIP 960,000",
    thresholdLabel: "55% ACTIVATION TARGET",
    thresholdPercentLabel: "55%",
  });

  assert.equal(
    hasMonitorImageParams({
      period: null,
      tip: null,
      blocks: null,
      signals: null,
      pct: null,
      updated: null,
    }),
    false,
  );
  assert.equal(parseMonitorImageData({ ...params, blocks: "1.5" }), null);
  assert.equal(parseMonitorImageData({ ...params, signals: "1009" }), null);
  assert.equal(parseMonitorImageData({ ...params, period: "1065221" }), null);
});

test("mempool blocks are normalized and signal through versionbits", () => {
  const block = parseMempoolBlock({
    id: "b".repeat(64),
    height: 959_859,
    timestamp: 2_200_000_000,
    tx_count: 4_077,
    version: 0x2000_0010,
  });

  assert.equal(block.signaling, true);
  assert.equal(block.time, 2_200_000_000);
  assert.equal(isBip110SignalingVersion(0x2000_0010), true);
  assert.equal(isBip110SignalingVersion(0x0000_0010), false);
  assert.equal(isBip110SignalingVersion(0x2000_0000), false);
});

test("mempool request boundaries require exact heights and block identities", () => {
  assert.equal(parsePositiveHeight("961058"), 961_058);
  assert.equal(parsePositiveHeight("961058junk"), null);
  assert.equal(parsePositiveHeight("0"), null);
  assert.equal(parsePositiveHeight("2147483648"), null);
  assert.doesNotThrow(() =>
    validateTransactionRequest("a".repeat(64), 3_000_000_000),
  );
  assert.throws(
    () => validateTransactionRequest("not-a-hash", 1),
    /hash is invalid/,
  );
  assert.throws(
    () => validateTransactionRequest("a".repeat(64), 1.5),
    /count is invalid/,
  );
});

test("mempool pagination plans preserve bounded ranges and concurrency", async () => {
  assert.deepEqual(descendingPageStarts(100, 31, 15), [100, 85, 70]);
  assert.deepEqual(ascendingPageStarts(51, 25), [0, 25, 50]);

  const block = (height, hashDigit) => ({
    hash: hashDigit.repeat(64),
    height,
    nTx: 1,
    signaling: false,
    time: 1,
    version: 0x2000_0000,
  });
  assert.deepEqual(
    selectBlockRange(
      [block(99, "a"), block(101, "b"), block(100, "c"), block(99, "d")],
      100,
      2,
    ),
    [block(100, "c"), block(99, "a")],
  );

  let active = 0;
  let maximumActive = 0;
  const values = await mapConcurrent([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await new Promise((resolve) => setTimeout(resolve, 0));
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(values, [2, 4, 6, 8, 10]);
  assert.equal(maximumActive, 2);
  await assert.rejects(
    () => mapConcurrent([1], 0, async (value) => value),
    /concurrency must be positive/,
  );
});

test("monitor snapshots can be reconstructed from contiguous block summaries", () => {
  const data = monitorDataFromBlocks(
    [
      {
        hash: "c".repeat(64),
        height: 4_033,
        nTx: 20,
        signaling: true,
        time: 1_785_170_435,
        version: 0x2000_0010,
      },
      {
        hash: "d".repeat(64),
        height: 4_032,
        nTx: 10,
        signaling: false,
        time: 1_785_169_835,
        version: 0x2000_0000,
      },
    ],
    "2026-07-27T12:00:00.000Z",
  );

  assert.equal(data.tip, 4_033);
  assert.equal(data.periodStart, 4_032);
  assert.equal(data.periodEnd, 6_047);
  assert.equal(data.totalBlocks, 2);
  assert.equal(data.signalingCount, 1);
  assert.equal(data.pct, 50);
  assert.throws(
    () =>
      monitorDataFromBlocks(
        [
          {
            hash: "c".repeat(64),
            height: 4_033,
            nTx: 20,
            signaling: true,
            time: 1_785_170_435,
            version: 0x2000_0010,
          },
        ],
        "2026-07-27T12:00:00.000Z",
      ),
    /do not cover the current period/,
  );
});

test("monitor HTML remains a valid block metadata provider", () => {
  const payload = parseBip110MonitorHtml(`
    <div class="block-tile sig" data-height="959859" data-hash="${"e".repeat(64)}" data-version="0x20000010" data-time="2026-07-27 12:00:00 UTC" data-ntx="4077">
    Updated: 2026-07-27 12:01:00 UTC
  `);

  assert.equal(payload.blocks.length, 1);
  assert.equal(payload.blocks[0].height, 959_859);
  assert.equal(payload.blocks[0].signaling, true);
  assert.equal(payload.updatedAt, "2026-07-27T12:01:00.000Z");
});

test("monitor source validation rejects malformed extracted block fields", () => {
  const validBlock = {
    status: "sig",
    height: "959859",
    hash: "e".repeat(64),
    version: "20000010",
    time: "2026-07-27 12:00:00 UTC",
    nTx: "4077",
  };
  const payload = monitorBlocksFromExtracted(
    [
      validBlock,
      { ...validBlock, height: "959859.5" },
      { ...validBlock, nTx: "2147483648" },
      { ...validBlock, version: "not-hex" },
      { ...validBlock, time: "not-a-date" },
      { ...validBlock, hash: "short" },
    ],
    "not-a-date",
    "2026-07-27T12:02:00.000Z",
  );

  assert.equal(payload.blocks.length, 1);
  assert.deepEqual(payload.blocks[0], {
    hash: validBlock.hash,
    height: 959_859,
    nTx: 4_077,
    signaling: true,
    time: 1_785_153_600,
    version: 0x2000_0010,
  });
  assert.equal(payload.updatedAt, "2026-07-27T12:02:00.000Z");
});

test("the backup classifier detects every BIP-110 rule category", () => {
  const taprootPrevout = `5120${"33".repeat(32)}`;
  const controlBlock = `c0${"44".repeat(32)}`;

  assert.deepEqual(
    bip110TransactionViolations(
      decodedTransaction({ outputScript: "51".repeat(35) }),
    ),
    ["large-script-pubkey"],
  );
  assert.deepEqual(
    bip110TransactionViolations(
      decodedTransaction({ witness: ["55".repeat(257)] }),
    ),
    ["large-pushdata"],
  );
  assert.deepEqual(
    bip110TransactionViolations(
      decodedTransaction({ prevoutScript: "5202aabb" }),
    ),
    ["undefined-witness"],
  );
  assert.deepEqual(
    bip110TransactionViolations(
      decodedTransaction({
        prevoutScript: taprootPrevout,
        witness: ["51", controlBlock, "50"],
      }),
    ),
    ["taproot-annex"],
  );
  assert.deepEqual(
    bip110TransactionViolations(
      decodedTransaction({
        prevoutScript: taprootPrevout,
        witness: ["51", `c0${"44".repeat(257)}`],
      }),
    ),
    ["large-control-block"],
  );
  assert.deepEqual(
    bip110TransactionViolations(
      decodedTransaction({
        prevoutScript: taprootPrevout,
        witness: ["50", controlBlock],
      }),
    ),
    ["op-success"],
  );
  assert.deepEqual(
    bip110TransactionViolations(
      decodedTransaction({
        prevoutScript: taprootPrevout,
        witness: ["63", controlBlock],
      }),
    ),
    ["op-if-notif"],
  );
});

test("the backup classifier counts a transaction once across multiple rules", () => {
  const clean = decodedTransaction({ txid: "f".repeat(64) });
  const violating = decodedTransaction({
    outputScript: "51".repeat(35),
    txid: "1".repeat(64),
    witness: ["55".repeat(257)],
  });

  assert.equal(countBip110ViolatingTransactions([clean, violating]), 1);
});

test("the backup classifier accepts non-witness transaction inputs", () => {
  const transaction = decodedTransaction();
  delete transaction.vin[0].witness;

  assert.deepEqual(bip110TransactionViolations(transaction), []);
});
