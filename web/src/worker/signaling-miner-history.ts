import { DurableObject } from "cloudflare:workers";

import {
  parseBlockMiningAttribution,
  signalingMinerId,
  type BlockMiningAttribution,
  type SignalingMinerDiscovery,
} from "../lib/monitor";
import {
  historicalFirstSignals,
  historicalSignalingMinerId,
} from "./historical-signaling-miners";
import { MEMPOOL_PROVIDERS } from "./mempool-api.ts";
import { readFirstAvailable } from "./provider-fallback.ts";

const MAX_PERIOD_SIGNALS = 2016;
const MAX_DISCOVERIES_PER_CALL = 40;
const DISCOVERY_CONCURRENCY = 8;
const UNRESOLVED_RETRY_MS = 60 * 60 * 1000;
const BLOCK_HASH_PATTERN = /^[0-9a-f]{64}$/;

/** Minimal signaling block data sent across the Durable Object RPC boundary */
export interface SignalingBlockReference {
  hash: string;
  height: number;
}

/** Persistent miner discovery for one signaling block */
export interface SignalingBlockClassification {
  discovery: SignalingMinerDiscovery;
  hash: string;
}

type StoredSignalingBlock = {
  checked_at: number;
  first_signal: number;
  height: number;
  pool_name: string | null;
  pool_slug: string | null;
  status: "identified" | "unavailable" | "unidentified";
  template_miner_name: string | null;
};

interface DiscoveredBlockMiner {
  attribution: BlockMiningAttribution | null;
  block: SignalingBlockReference;
}

/**
 * Owns the globally ordered set of BIP-110 signaling miners so period changes
 * cannot reset first-signal discovery
 */
export class SignalingMinerHistory extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.migrate());
  }

  /** Classifies current-period signals against all previously stored signals */
  async classify(
    periodStart: number,
    blocks: readonly SignalingBlockReference[],
  ): Promise<SignalingBlockClassification[]> {
    const orderedBlocks = validatedSignalingBlocks(periodStart, blocks);
    this.reconcileCurrentPeriod(periodStart, orderedBlocks);

    const storedClassifications = new Map<string, SignalingMinerDiscovery>();
    const missingBlocks: SignalingBlockReference[] = [];

    for (const block of orderedBlocks) {
      const stored = this.storedDiscovery(block.hash);

      if (stored) {
        storedClassifications.set(block.hash, stored);
      } else {
        missingBlocks.push(block);
      }
    }

    const discoveredAttributions = await discoverBlockMiners(
      missingBlocks.slice(0, MAX_DISCOVERIES_PER_CALL),
    );
    const newClassifications = new Map<string, SignalingMinerDiscovery>();

    for (const { attribution, block } of discoveredAttributions) {
      const discovery = attribution
        ? this.persistDiscovery(block, attribution)
        : this.persistUnresolved(block, "unavailable");

      newClassifications.set(block.hash, discovery);
    }

    return orderedBlocks.map((block) => ({
      discovery: storedClassifications.get(block.hash) ??
        newClassifications.get(block.hash) ?? { status: "unavailable" },
      hash: block.hash,
    }));
  }

  private migrate(): void {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS _sql_schema_migrations (
        id INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    const currentVersion = this.ctx.storage.sql
      .exec<{
        version: number;
      }>("SELECT COALESCE(MAX(id), 0) AS version FROM _sql_schema_migrations")
      .one().version;

    if (currentVersion < 1) {
      this.ctx.storage.sql.exec(`
        CREATE TABLE signaling_miners (
          miner_id TEXT PRIMARY KEY,
          first_height INTEGER NOT NULL,
          first_hash TEXT
        );
        CREATE TABLE signaling_blocks (
          hash TEXT PRIMARY KEY,
          height INTEGER NOT NULL,
          status TEXT NOT NULL
            CHECK (status IN ('identified', 'unidentified', 'unavailable')),
          miner_id TEXT,
          pool_name TEXT,
          pool_slug TEXT,
          template_miner_name TEXT,
          first_signal INTEGER NOT NULL CHECK (first_signal IN (0, 1)),
          checked_at INTEGER NOT NULL
        );
        CREATE INDEX signaling_blocks_height
          ON signaling_blocks (height);
        INSERT INTO _sql_schema_migrations (id) VALUES (1);
      `);
    }

    this.seedHistoricalMiners();
  }

  private seedHistoricalMiners(): void {
    for (const signal of historicalFirstSignals()) {
      this.ctx.storage.sql.exec(
        `INSERT OR IGNORE INTO signaling_miners
          (miner_id, first_height, first_hash)
         VALUES (?, ?, NULL)`,
        historicalSignalingMinerId(signal),
        signal.height,
      );
    }
  }

  private reconcileCurrentPeriod(
    periodStart: number,
    blocks: readonly SignalingBlockReference[],
  ): void {
    const currentHashes = new Set(blocks.map((block) => block.hash));
    const staleBlocks = this.ctx.storage.sql
      .exec<{ hash: string }>(
        "SELECT hash FROM signaling_blocks WHERE height >= ?",
        periodStart,
      )
      .toArray()
      .filter((block) => !currentHashes.has(block.hash));

    if (staleBlocks.length === 0) return;

    this.ctx.storage.transactionSync(() => {
      for (const block of staleBlocks) {
        this.ctx.storage.sql.exec(
          "DELETE FROM signaling_blocks WHERE hash = ?",
          block.hash,
        );
      }

      this.ctx.storage.sql.exec("DELETE FROM signaling_miners");
      this.seedHistoricalMiners();
      this.ctx.storage.sql.exec(`
        INSERT OR IGNORE INTO signaling_miners
          (miner_id, first_height, first_hash)
        SELECT miner_id, height, hash
        FROM signaling_blocks
        WHERE status = 'identified'
        ORDER BY height ASC
      `);
      this.ctx.storage.sql.exec(`
        UPDATE signaling_blocks
        SET first_signal = (
          status = 'identified'
          AND height = (
              SELECT first_height
              FROM signaling_miners
              WHERE signaling_miners.miner_id = signaling_blocks.miner_id
          )
        )
      `);
    });
  }

  private storedDiscovery(hash: string): SignalingMinerDiscovery | null {
    const rows = this.ctx.storage.sql
      .exec<StoredSignalingBlock>(
        `SELECT
          checked_at,
          first_signal,
          height,
          pool_name,
          pool_slug,
          status,
          template_miner_name
         FROM signaling_blocks
         WHERE hash = ?`,
        hash,
      )
      .toArray();
    const block = rows[0];
    if (!block) return null;

    if (block.status !== "identified") {
      if (Date.now() - block.checked_at < UNRESOLVED_RETRY_MS) {
        return { status: block.status };
      }

      this.ctx.storage.sql.exec(
        "DELETE FROM signaling_blocks WHERE hash = ?",
        hash,
      );
      return null;
    }

    if (!block.pool_name) {
      throw new Error(`identified signaling block ${hash} has no pool name`);
    }

    return {
      status: "identified",
      attribution: {
        poolName: block.pool_name,
        poolSlug: block.pool_slug,
        templateMinerName: block.template_miner_name,
      },
      firstSignal: block.first_signal === 1,
    };
  }

  private persistDiscovery(
    block: SignalingBlockReference,
    attribution: BlockMiningAttribution,
  ): SignalingMinerDiscovery {
    const minerId = signalingMinerId(attribution);
    if (!minerId) {
      return this.persistUnresolved(block, "unidentified", attribution);
    }

    return this.ctx.storage.transactionSync(() => {
      const stored = this.storedDiscovery(block.hash);
      if (stored) return stored;

      const knownMiner = this.ctx.storage.sql
        .exec<{
          miner_id: string;
        }>("SELECT miner_id FROM signaling_miners WHERE miner_id = ?", minerId)
        .toArray()[0];
      const firstSignal = !knownMiner;

      if (firstSignal) {
        this.ctx.storage.sql.exec(
          `INSERT INTO signaling_miners
            (miner_id, first_height, first_hash)
           VALUES (?, ?, ?)`,
          minerId,
          block.height,
          block.hash,
        );
      }

      this.ctx.storage.sql.exec(
        `INSERT INTO signaling_blocks
          (
            hash,
            height,
            status,
            miner_id,
            pool_name,
            pool_slug,
            template_miner_name,
            first_signal,
            checked_at
          )
         VALUES (?, ?, 'identified', ?, ?, ?, ?, ?, ?)`,
        block.hash,
        block.height,
        minerId,
        attribution.poolName,
        attribution.poolSlug,
        attribution.templateMinerName,
        firstSignal ? 1 : 0,
        Date.now(),
      );

      return {
        status: "identified",
        attribution,
        firstSignal,
      };
    });
  }

  private persistUnresolved(
    block: SignalingBlockReference,
    status: "unavailable" | "unidentified",
    attribution?: BlockMiningAttribution,
  ): SignalingMinerDiscovery {
    return this.ctx.storage.transactionSync(() => {
      const stored = this.storedDiscovery(block.hash);
      if (stored) return stored;

      this.ctx.storage.sql.exec(
        `INSERT INTO signaling_blocks
          (
            hash,
            height,
            status,
            miner_id,
            pool_name,
            pool_slug,
            template_miner_name,
            first_signal,
            checked_at
          )
         VALUES (?, ?, ?, NULL, ?, ?, ?, 0, ?)`,
        block.hash,
        block.height,
        status,
        attribution?.poolName ?? null,
        attribution?.poolSlug ?? null,
        attribution?.templateMinerName ?? null,
        Date.now(),
      );

      return { status };
    });
  }
}

function validatedSignalingBlocks(
  periodStart: number,
  blocks: readonly SignalingBlockReference[],
): SignalingBlockReference[] {
  if (!Number.isSafeInteger(periodStart) || periodStart <= 0) {
    throw new Error("signaling period start is invalid");
  }

  if (blocks.length > MAX_PERIOD_SIGNALS) {
    throw new Error("signaling block list exceeds one period");
  }

  const uniqueBlocks = new Map<string, SignalingBlockReference>();

  for (const block of blocks) {
    if (
      !BLOCK_HASH_PATTERN.test(block.hash) ||
      !Number.isSafeInteger(block.height) ||
      block.height < periodStart ||
      block.height >= periodStart + MAX_PERIOD_SIGNALS
    ) {
      throw new Error("signaling block reference is invalid");
    }

    uniqueBlocks.set(block.hash, block);
  }

  return [...uniqueBlocks.values()].sort(
    (left, right) => left.height - right.height,
  );
}

async function discoverBlockMiner(
  hash: string,
): Promise<BlockMiningAttribution | null> {
  try {
    const result = await readFirstAvailable(
      MEMPOOL_PROVIDERS,
      async (provider) => {
        const response = await fetch(`${provider.apiUrl}/v1/block/${hash}`);
        if (!response.ok) {
          throw new Error(`${provider.id} returned ${response.status}`);
        }

        return parseBlockMiningAttribution(await response.json());
      },
      "block mining attribution providers unavailable",
    );

    return result.value;
  } catch {
    return null;
  }
}

async function discoverBlockMiners(
  blocks: readonly SignalingBlockReference[],
): Promise<DiscoveredBlockMiner[]> {
  const discovered: DiscoveredBlockMiner[] = [];

  for (let index = 0; index < blocks.length; index += DISCOVERY_CONCURRENCY) {
    const batch = blocks.slice(index, index + DISCOVERY_CONCURRENCY);
    discovered.push(
      ...(await Promise.all(
        batch.map(async (block) => ({
          attribution: await discoverBlockMiner(block.hash),
          block,
        })),
      )),
    );
  }

  return discovered;
}
