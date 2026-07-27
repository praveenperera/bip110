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
  MANDATORY_SIGNALING_HEIGHT,
  mandatorySignalingEstimate,
  shouldShowMandatorySignaling,
} from "../src/lib/mandatory-signaling.ts";
import {
  bip110TransactionViolations,
  countBip110ViolatingTransactions,
  isAuthoritativeKilombinoViolationReport,
} from "../src/worker/bip110-violations.ts";
import {
  isBip110SignalingVersion,
  parseMempoolBlock,
} from "../src/worker/mempool-api.ts";
import { monitorDataFromBlocks } from "../src/worker/monitor-data.ts";
import { parseBip110MonitorHtml } from "../src/worker/monitor-source.ts";
import { readFirstAvailable } from "../src/worker/provider-fallback.ts";

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

test("mempool blocks are normalized and signal through versionbits", () => {
  const block = parseMempoolBlock({
    id: "b".repeat(64),
    height: 959_859,
    timestamp: 1_785_170_435,
    tx_count: 4_077,
    version: 0x2000_0010,
  });

  assert.equal(block.signaling, true);
  assert.equal(isBip110SignalingVersion(0x2000_0010), true);
  assert.equal(isBip110SignalingVersion(0x0000_0010), false);
  assert.equal(isBip110SignalingVersion(0x2000_0000), false);
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
