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
