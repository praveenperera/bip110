import { PERIOD_SIZE, type UnclassifiedMonitorBlock } from "../lib/monitor.ts";
import { readFirstAvailable } from "./provider-fallback.ts";

const MEMPOOL_PAGE_SIZE = 15;
const MEMPOOL_TRANSACTION_PAGE_SIZE = 25;
const MEMPOOL_REQUEST_TIMEOUT_MS = 5_000;
const MAX_JSON_RESPONSE_BYTES = 12_000_000;
const FETCH_CONCURRENCY = 6;
const VERSION_BITS_TOP_MASK = 0xe000_0000;
const VERSION_BITS_TOP_BITS = 0x2000_0000;
const BIP110_VERSION_BIT = 4;

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

/** Returns whether a block version uses versionbits signaling for BIP-110 */
export function isBip110SignalingVersion(version: number): boolean {
  return (
    (version & VERSION_BITS_TOP_MASK) === VERSION_BITS_TOP_BITS &&
    (version & (1 << BIP110_VERSION_BIT)) !== 0
  );
}

/** Parses a mempool-compatible block summary */
export function parseMempoolBlock(value: unknown): UnclassifiedMonitorBlock {
  if (!isRecord(value)) {
    throw new Error("mempool block response must be an object");
  }

  const hash = stringField(value, "id");
  if (!/^[0-9a-f]{64}$/i.test(hash)) {
    throw new Error("mempool block id must be a block hash");
  }

  const version = integerField(value, "version");

  return {
    hash,
    height: nonNegativeIntegerField(value, "height"),
    nTx: nonNegativeIntegerField(value, "tx_count"),
    signaling: isBip110SignalingVersion(version),
    time: nonNegativeIntegerField(value, "timestamp"),
    version,
  };
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
  if (!/^[0-9a-f]{64}$/i.test(block.hash)) {
    throw new Error("block transaction request hash is invalid");
  }
  if (!Number.isSafeInteger(block.nTx) || block.nTx <= 0) {
    throw new Error("block transaction request count is invalid");
  }

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
  const value = Number.parseInt((await response.text()).trim(), 10);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${provider.id} returned an invalid chain tip`);
  }

  return value;
}

async function readProviderBlocks(
  provider: MempoolProvider,
  startHeight: number,
  limit: number,
): Promise<UnclassifiedMonitorBlock[]> {
  const pageHeights: number[] = [];

  for (
    let height = startHeight;
    height > startHeight - limit;
    height -= MEMPOOL_PAGE_SIZE
  ) {
    pageHeights.push(height);
  }

  const pages = await mapConcurrent(
    pageHeights,
    FETCH_CONCURRENCY,
    async (height) => readProviderBlockPage(provider, height),
  );
  const minimumHeight = Math.max(startHeight - limit + 1, 0);
  const blocks = uniqueBlocks(
    pages
      .flatMap((page) => page.blocks)
      .filter(
        (block) => block.height >= minimumHeight && block.height <= startHeight,
      ),
  ).slice(0, limit);

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
  const pageIndexes: number[] = [];

  for (
    let index = 0;
    index < block.nTx;
    index += MEMPOOL_TRANSACTION_PAGE_SIZE
  ) {
    pageIndexes.push(index);
  }

  const pages = await mapConcurrent(
    pageIndexes,
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

async function mapConcurrent<Input, Output>(
  values: readonly Input[],
  concurrency: number,
  map: (value: Input) => Promise<Output>,
): Promise<Output[]> {
  const output: Output[] = [];

  for (let index = 0; index < values.length; index += concurrency) {
    output.push(
      ...(await Promise.all(values.slice(index, index + concurrency).map(map))),
    );
  }

  return output;
}

function uniqueBlocks(
  blocks: readonly UnclassifiedMonitorBlock[],
): UnclassifiedMonitorBlock[] {
  const byHeight = new Map<number, UnclassifiedMonitorBlock>();

  for (const block of [...blocks].sort(
    (left, right) => right.height - left.height,
  )) {
    if (!byHeight.has(block.height)) {
      byHeight.set(block.height, block);
    }
  }

  return [...byHeight.values()];
}

function hasContiguousRange(
  blocks: readonly UnclassifiedMonitorBlock[],
  start: number,
  end: number,
): boolean {
  if (blocks.length !== end - start + 1) return false;

  return blocks.every((block, index) => block.height === end - index);
}

function validateBlockRange(startHeight: number, limit: number): void {
  if (!Number.isSafeInteger(startHeight) || startHeight <= 0) {
    throw new Error("mempool block start height is invalid");
  }
  if (!Number.isSafeInteger(limit) || limit <= 0 || limit > PERIOD_SIZE) {
    throw new Error("mempool block limit is invalid");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(
  value: Record<string, unknown>,
  fieldName: string,
): string {
  const fieldValue = value[fieldName];
  if (typeof fieldValue !== "string") {
    throw new Error(`mempool block field ${fieldName} must be a string`);
  }

  return fieldValue;
}

function integerField(
  value: Record<string, unknown>,
  fieldName: string,
): number {
  const fieldValue = value[fieldName];
  if (!Number.isSafeInteger(fieldValue)) {
    throw new Error(`mempool block field ${fieldName} must be an integer`);
  }

  return fieldValue as number;
}

function nonNegativeIntegerField(
  value: Record<string, unknown>,
  fieldName: string,
): number {
  const fieldValue = integerField(value, fieldName);
  if (fieldValue < 0) {
    throw new Error(
      `mempool block field ${fieldName} must be a non-negative integer`,
    );
  }

  return fieldValue;
}
