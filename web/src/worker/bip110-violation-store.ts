import { DurableObject } from "cloudflare:workers";

import {
  isRefreshToken,
  type blockReference as ViolationBlockReference,
  type storedReport as StoredViolationReport,
  validateBlocks,
  validateReports,
} from "./ViolationStoreModel.gen.ts";

const REFRESH_LEASE_MS = 5 * 60 * 1_000;

type StoredViolationRow = {
  hash: string;
  height: number;
  violation_count: number;
};

type StoredRefreshLease = {
  expires_at: number;
};

type ViolationRefreshState =
  | { status: "busy" }
  | { status: "claimed"; token: string }
  | { status: "complete" };

type ViolationStoreSnapshot = {
  refresh: ViolationRefreshState;
  reports: StoredViolationReport[];
};

/**
 * Stores verified BIP-110 counts and globally coordinates refreshes for one
 * difficulty period
 */
export class Bip110ViolationStore extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.migrate());
  }

  /** Reads verified reports and leases one background refresh when needed */
  async readAndClaim(
    periodStart: number,
    blocks: readonly ViolationBlockReference[],
  ): Promise<ViolationStoreSnapshot> {
    const validatedBlocks = validateBlocks(periodStart, [...blocks]);
    const now = Date.now();

    return this.ctx.storage.transactionSync(() => {
      const storedRows = this.readRows(validatedBlocks);
      this.reconcileBlocks(validatedBlocks, storedRows);
      const requestedHashes = new Set(
        validatedBlocks.map((block) => block.hash),
      );
      const reports = storedRows
        .filter((row) => requestedHashes.has(row.hash))
        .map(storedReport);

      if (reports.length === validatedBlocks.length) {
        this.ctx.storage.sql.exec(
          "DELETE FROM violation_refresh_lease WHERE id = 1",
        );
        return {
          refresh: { status: "complete" },
          reports,
        };
      }

      const lease = this.ctx.storage.sql
        .exec<StoredRefreshLease>(
          "SELECT expires_at FROM violation_refresh_lease WHERE id = 1",
        )
        .toArray()[0];
      if (lease && lease.expires_at > now) {
        return {
          refresh: { status: "busy" },
          reports,
        };
      }

      const token = crypto.randomUUID();
      this.ctx.storage.sql.exec(
        `INSERT INTO violation_refresh_lease (id, token, expires_at)
         VALUES (1, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           token = excluded.token,
           expires_at = excluded.expires_at`,
        token,
        now + REFRESH_LEASE_MS,
      );

      return {
        refresh: { status: "claimed", token },
        reports,
      };
    });
  }

  /** Persists authoritative provider or locally reconstructed reports */
  async putReports(
    periodStart: number,
    reports: readonly StoredViolationReport[],
  ): Promise<void> {
    const validatedReports = validateReports(periodStart, [...reports]);
    const checkedAt = Date.now();

    this.ctx.storage.transactionSync(() => {
      for (const report of validatedReports) {
        this.ctx.storage.sql.exec(
          "DELETE FROM violation_reports WHERE height = ? AND hash <> ?",
          report.height,
          report.hash,
        );
        this.ctx.storage.sql.exec(
          `INSERT INTO violation_reports
            (hash, height, violation_count, checked_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (hash) DO UPDATE SET
             height = excluded.height,
             violation_count = excluded.violation_count,
             checked_at = excluded.checked_at`,
          report.hash,
          report.height,
          report.count,
          checkedAt,
        );
      }
    });
  }

  /** Releases a refresh lease only when the caller still owns it */
  async finishRefresh(token: string): Promise<void> {
    if (!isRefreshToken(token)) {
      throw new Error("violation refresh token is invalid");
    }

    this.ctx.storage.sql.exec(
      "DELETE FROM violation_refresh_lease WHERE id = 1 AND token = ?",
      token,
    );
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

    if (currentVersion >= 1) return;

    this.ctx.storage.sql.exec(`
      CREATE TABLE violation_reports (
        hash TEXT PRIMARY KEY,
        height INTEGER NOT NULL UNIQUE,
        violation_count INTEGER NOT NULL CHECK (violation_count >= 0),
        checked_at INTEGER NOT NULL
      );
      CREATE TABLE violation_refresh_lease (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        token TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      );
      INSERT INTO _sql_schema_migrations (id) VALUES (1);
    `);
  }

  private reconcileBlocks(
    blocks: readonly ViolationBlockReference[],
    storedRows: readonly StoredViolationRow[],
  ): void {
    const storedByHeight = new Map(
      storedRows.map((row) => [row.height, row.hash]),
    );

    for (const block of blocks) {
      const storedHash = storedByHeight.get(block.height);
      if (!storedHash || storedHash === block.hash) continue;

      this.ctx.storage.sql.exec(
        "DELETE FROM violation_reports WHERE hash = ?",
        storedHash,
      );
    }
  }

  private readRows(
    blocks: readonly ViolationBlockReference[],
  ): StoredViolationRow[] {
    const minimumHeight = blocks.at(-1)?.height;
    const maximumHeight = blocks[0]?.height;
    if (minimumHeight === undefined || maximumHeight === undefined) return [];

    return this.ctx.storage.sql
      .exec<StoredViolationRow>(
        `SELECT hash, height, violation_count
         FROM violation_reports
         WHERE height BETWEEN ? AND ?
         ORDER BY height DESC`,
        minimumHeight,
        maximumHeight,
      )
      .toArray();
  }
}

function storedReport(row: StoredViolationRow): StoredViolationReport {
  return {
    count: row.violation_count,
    hash: row.hash,
    height: row.height,
  };
}
