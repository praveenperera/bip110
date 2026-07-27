import type {
  Bip110BlockViolationReport,
  UnclassifiedMonitorBlock,
} from "../lib/monitor.ts";
import {
  bip110TransactionViolations,
  countBip110ViolatingTransactions,
  isAuthoritativeKilombinoViolationReport,
  type violation as Bip110Violation,
} from "./Bip110Violations.gen.ts";
import { readMempoolBlockTransactions } from "./mempool-api.ts";

export type { Bip110Violation };

/** Reconstructs one block's BIP-110 violation count from public transaction data */
export async function reconstructBip110ViolationReport(
  block: UnclassifiedMonitorBlock,
): Promise<Bip110BlockViolationReport> {
  const { transactions } = await readMempoolBlockTransactions(block);

  return {
    hash: block.hash,
    height: block.height,
    violations: {
      status: "known",
      count: countBip110ViolatingTransactions(transactions),
    },
  };
}

export {
  bip110TransactionViolations,
  countBip110ViolatingTransactions,
  isAuthoritativeKilombinoViolationReport,
};
