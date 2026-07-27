import { PERIOD_SIZE, type UnclassifiedMonitorBlock } from "../lib/monitor.ts";
import {
  ascendingPageStarts,
  descendingPageStarts,
  hasContiguousRange,
  isBip110SignalingVersion,
  mapConcurrent,
  parseMempoolBlock,
  parsePositiveHeight,
  selectBlockRange,
  validateBlockRange,
  validateTransactionRequest,
} from "./Mempool.gen.ts";
import { readFirstAvailable } from "./provider-fallback.ts";

const MEMPOOL_PAGE_SIZE = 15;
const MEMPOOL_TRANSACTION_PAGE_SIZE = 25;
const MEMPOOL_REQUEST_TIMEOUT_MS = 5_000;
const MAX_JSON_RESPONSE_BYTES = 12_000_000;
const FETCH_CONCURRENCY = 6;

/** Ordered public mempool-compatible providers used for automatic failover */
export const MEMPOOL_PROVIDERS = [
  {
    id: "mempool-space",
    apiUrl: "https://mempool.space/api",
  },
  {
    id: "mempool-guide",
    apiUrl: "https://mempool.guide/api",
  },
] as const;

/** One configured public mempool-compatible provider */
export type MempoolProvider = (typeof MEMPOOL_PROVIDERS)[number];

/** Stable identifier for a configured mempool-compatible provider */
export type MempoolProviderId = MempoolProvider["id"];

/** Blocks read from one mempool-compatible provider */
export interface MempoolBlocksResult {
  blocks: UnclassifiedMonitorBlock[];
  provider: MempoolProviderId;
  updatedAt: string;
}

/** One complete difficulty period read from a mempool-compatible provider */
export interface MempoolPeriodResult extends MempoolBlocksResult {
  tip: number;
}

interface MempoolBlockPage {
  blocks: UnclassifiedMonitorBlock[];
}

/** Reads recent blocks with automatic mempool.space to mempool.guide failover */
export async function readMempoolBlocks(
  startHeight: number,
  limit: number,
): Promise<MempoolBlocksResult> {
  validateBlockRange(startHeight, limit);

  const result = await readFirstAvailable(
    MEMPOOL_PROVIDERS,
    async (provider) => ({
      blocks: await readProviderBlocks(provider, startHeight, limit),
      updatedAt: new Date().toISOString(),
    }),
    "mempool block providers unavailable",
  );

  return {
    ...result.value,
    provider: result.provider.id,
  };
}

/** Reads the current difficulty period from one available mempool provider */
export async function readMempoolPeriod(): Promise<MempoolPeriodResult> {
  const result = await readFirstAvailable(
    MEMPOOL_PROVIDERS,
    async (provider) => {
      const tip = await readProviderTip(provider);
      const periodStart = Math.floor(tip / PERIOD_SIZE) * PERIOD_SIZE;
      const expectedBlocks = tip - periodStart + 1;
      const blocks = await readProviderBlocks(provider, tip, expectedBlocks);

      if (!hasContiguousRange(blocks, periodStart, tip)) {
        throw new Error(`${provider.id} returned an incomplete current period`);
      }

      return {
        blocks,
        tip,
        updatedAt: new Date().toISOString(),
      };
    },
    "mempool period providers unavailable",
  );

  return {
    ...result.value,
    provider: result.provider.id,
  };
}

/** Reads every decoded transaction in a block with provider failover */
export async function readMempoolBlockTransactions(
  block: Pick<UnclassifiedMonitorBlock, "hash" | "nTx">,
): Promise<{ provider: MempoolProviderId; transactions: unknown[] }> {
  validateTransactionRequest(block.hash, block.nTx);

  const result = await readFirstAvailable(
    MEMPOOL_PROVIDERS,
    (provider) => readProviderBlockTransactions(provider, block),
    "mempool transaction providers unavailable",
  );

  return {
    provider: result.provider.id,
    transactions: result.value,
  };
}

async function readProviderTip(provider: MempoolProvider): Promise<number> {
  const response = await fetchWithTimeout(
    `${provider.apiUrl}/blocks/tip/height`,
    "text/plain",
  );
  const value = parsePositiveHeight((await response.text()).trim());

  if (value == null) {
    throw new Error(`${provider.id} returned an invalid chain tip`);
  }

  return value;
}

async function readProviderBlocks(
  provider: MempoolProvider,
  startHeight: number,
  limit: number,
): Promise<UnclassifiedMonitorBlock[]> {
  const pages = await mapConcurrent(
    descendingPageStarts(startHeight, limit, MEMPOOL_PAGE_SIZE),
    FETCH_CONCURRENCY,
    async (height) => readProviderBlockPage(provider, height),
  );
  const blocks = selectBlockRange(
    pages.flatMap((page) => page.blocks),
    startHeight,
    limit,
  );

  if (blocks.length === 0) {
    throw new Error(`${provider.id} returned no blocks`);
  }

  return blocks;
}

async function readProviderBlockPage(
  provider: MempoolProvider,
  height: number,
): Promise<MempoolBlockPage> {
  const response = await fetchWithTimeout(
    `${provider.apiUrl}/v1/blocks/${height}`,
    "application/json",
  );
  const value = await readJson(response);

  if (!Array.isArray(value)) {
    throw new Error(`${provider.id} block page must be an array`);
  }

  const blocks = value.map(parseMempoolBlock);
  if (blocks.length === 0) {
    throw new Error(`${provider.id} returned an empty block page`);
  }

  return { blocks };
}

async function readProviderBlockTransactions(
  provider: MempoolProvider,
  block: Pick<UnclassifiedMonitorBlock, "hash" | "nTx">,
): Promise<unknown[]> {
  const pages = await mapConcurrent(
    ascendingPageStarts(block.nTx, MEMPOOL_TRANSACTION_PAGE_SIZE),
    FETCH_CONCURRENCY,
    async (index) => {
      const response = await fetchWithTimeout(
        `${provider.apiUrl}/block/${block.hash}/txs/${index}`,
        "application/json",
      );
      const value = await readJson(response);

      if (!Array.isArray(value)) {
        throw new Error(`${provider.id} transaction page must be an array`);
      }

      return value;
    },
  );
  const transactions = pages.flat();

  if (transactions.length !== block.nTx) {
    throw new Error(
      `${provider.id} returned ${transactions.length} of ${block.nTx} transactions`,
    );
  }

  return transactions;
}

async function fetchWithTimeout(
  url: string,
  accept: string,
): Promise<Response> {
  const response = await fetch(url, {
    headers: { accept },
    signal: AbortSignal.timeout(MEMPOOL_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (
    contentLength &&
    Number.parseInt(contentLength, 10) > MAX_JSON_RESPONSE_BYTES
  ) {
    throw new Error(`${url} exceeded the response size limit`);
  }

  return response;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > MAX_JSON_RESPONSE_BYTES) {
    throw new Error(`${response.url} exceeded the response size limit`);
  }

  return JSON.parse(text) as unknown;
}

export {
  ascendingPageStarts,
  descendingPageStarts,
  isBip110SignalingVersion,
  mapConcurrent,
  parseMempoolBlock,
  parsePositiveHeight,
  selectBlockRange,
  validateTransactionRequest,
};
