/** Number of blocks in one difficulty adjustment period */
export const PERIOD_SIZE = 2016;

/** Signaling summary for one difficulty adjustment period */
export interface MonitorPeriod {
  periodNum: number;
  startBlock: number;
  endBlock: number;
  signalingCount: number;
  totalBlocks: number;
  pct: number;
}

/** Normalized monitor snapshot consumed by browser and Worker renderers */
export interface MonitorData {
  bip: string;
  tip: number;
  chainTip: number;
  periodNum: number;
  periodStart: number;
  periodEnd: number;
  totalBlocks: number;
  signalingCount: number;
  pct: number;
  periods: MonitorPeriod[];
  synced: boolean;
  updatedAt: string;
}

/** Known block details returned by the monitor blocks API */
export interface MonitorBlock {
  hash: string;
  height: number;
  nTx: number;
  signaling: boolean;
  time: number;
  version: number;
}

/** Mining attribution reported by the block explorer */
export interface BlockMiningAttribution {
  poolName: string;
  templateMinerName: string | null;
}

/** Wire payload returned by the monitor blocks API */
export interface MonitorBlocksPayload {
  blocks: MonitorBlock[];
  updatedAt: string;
}

/** Grid cell whose block details have not been loaded */
export interface PlaceholderMonitorGridBlock {
  kind: "placeholder";
  height: number;
}

/** Grid cell backed by known block details */
export type KnownMonitorGridBlock = MonitorBlock & {
  kind: "known";
};

/** A current-period grid cell with explicit detail availability */
export type MonitorGridBlock =
  | KnownMonitorGridBlock
  | PlaceholderMonitorGridBlock;

/** Parses and normalizes an external monitor snapshot */
export function parseMonitorData(value: unknown): MonitorData {
  if (!isRecord(value)) {
    throw new Error("monitor API response must be an object");
  }

  const data = {
    bip: stringField(value, "bip"),
    tip: numberField(value, "tip"),
    chainTip: numberField(value, "chainTip"),
    periodNum: numberField(value, "periodNum"),
    periodStart: numberField(value, "periodStart"),
    periodEnd: numberField(value, "periodEnd"),
    totalBlocks: numberField(value, "totalBlocks"),
    signalingCount: numberField(value, "signalingCount"),
    pct: numberField(value, "pct"),
    periods: periodsField(value),
    synced: booleanField(value, "synced"),
    updatedAt: stringField(value, "updatedAt"),
  };
  const normalizedData = {
    ...data,
    periods: normalizedMonitorPeriods(data),
  };

  if (!isReasonableMonitorData(normalizedData)) {
    throw new Error("monitor API response contains invalid values");
  }

  return normalizedData;
}

/** Parses an external monitor blocks payload */
export function parseMonitorBlocksPayload(
  value: unknown,
): MonitorBlocksPayload {
  if (!isRecord(value)) {
    throw new Error("monitor block API response must be an object");
  }

  if (!Array.isArray(value.blocks)) {
    throw new Error("monitor block API field blocks must be an array");
  }

  return {
    blocks: value.blocks.map(parseMonitorBlock),
    updatedAt: stringField(value, "updatedAt"),
  };
}

/** Parses mining attribution from a mempool-compatible block response */
export function parseBlockMiningAttribution(
  value: unknown,
): BlockMiningAttribution | null {
  if (!isRecord(value)) {
    throw new Error("block explorer response must be an object");
  }

  const extras = value.extras;
  if (!isRecord(extras) || !isRecord(extras.pool)) return null;

  const poolName = optionalNonEmptyString(extras.pool.name);
  if (!poolName) return null;

  const minerNames = extras.pool.minerNames;
  const templateMinerName =
    poolName === "OCEAN" && Array.isArray(minerNames)
      ? optionalNonEmptyString(minerNames[1])
      : null;

  return { poolName, templateMinerName };
}

/** Checks the range invariants enforced for monitor snapshots */
export function isReasonableMonitorData(data: MonitorData): boolean {
  return (
    data.tip > 0 &&
    data.chainTip > 0 &&
    data.periodNum > 0 &&
    data.periodStart > 0 &&
    data.periodEnd >= data.periodStart &&
    data.totalBlocks >= 0 &&
    data.totalBlocks <= PERIOD_SIZE &&
    data.signalingCount >= 0 &&
    data.signalingCount <= data.totalBlocks &&
    data.pct >= 0 &&
    data.pct <= 100 &&
    data.periods.every(isReasonableMonitorPeriod) &&
    data.updatedAt.length > 0
  );
}

/** Builds current-period grid cells with explicit known and placeholder states */
export function currentPeriodGrid(
  data: MonitorData,
  blocks: readonly MonitorBlock[] | null,
): MonitorGridBlock[] {
  const blocksByHeight = new Map(
    blocks?.map((block) => [block.height, block]) ?? [],
  );
  const firstHeight = Math.max(
    data.periodStart,
    data.tip - data.totalBlocks + 1,
  );
  const blockCount = Math.max(data.tip - firstHeight + 1, 0);

  return Array.from({ length: blockCount }, (_, index) => {
    const height = data.tip - index;
    const block = blocksByHeight.get(height);

    return block
      ? { ...block, kind: "known" }
      : { height, kind: "placeholder" };
  });
}

function normalizedMonitorPeriods(data: MonitorData): MonitorPeriod[] {
  const currentPeriod = {
    periodNum: data.periodNum,
    startBlock: data.periodStart,
    endBlock: data.periodEnd,
    signalingCount: data.signalingCount,
    totalBlocks: data.totalBlocks,
    pct: data.pct,
  };
  const previousPeriods = data.periods
    .filter((period) => period.periodNum !== data.periodNum)
    .sort((a, b) => b.periodNum - a.periodNum);

  return [currentPeriod, ...previousPeriods];
}

function isReasonableMonitorPeriod(period: MonitorPeriod): boolean {
  return (
    period.periodNum > 0 &&
    period.startBlock > 0 &&
    period.endBlock >= period.startBlock &&
    period.totalBlocks >= 0 &&
    period.totalBlocks <= PERIOD_SIZE &&
    period.signalingCount >= 0 &&
    period.signalingCount <= period.totalBlocks &&
    period.pct >= 0 &&
    period.pct <= 100
  );
}

function parseMonitorBlock(value: unknown): MonitorBlock {
  if (!isRecord(value)) {
    throw new Error("monitor block API block must be an object");
  }

  return {
    hash: stringField(value, "hash"),
    height: numberField(value, "height"),
    nTx: numberField(value, "nTx"),
    signaling: booleanField(value, "signaling"),
    time: numberField(value, "time"),
    version: numberField(value, "version"),
  };
}

function periodsField(value: Record<string, unknown>): MonitorPeriod[] {
  const fieldValue = value.periods;

  if (!Array.isArray(fieldValue)) {
    return [];
  }

  return fieldValue.map((period) => {
    if (!isRecord(period)) {
      throw new Error("monitor API period must be an object");
    }

    return {
      periodNum: numberField(period, "periodNum"),
      startBlock: numberField(period, "startBlock"),
      endBlock: numberField(period, "endBlock"),
      signalingCount: numberField(period, "signalingCount"),
      totalBlocks: numberField(period, "totalBlocks"),
      pct: numberField(period, "pct"),
    };
  });
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
    throw new Error(`monitor API field ${fieldName} must be a string`);
  }

  return fieldValue;
}

function numberField(
  value: Record<string, unknown>,
  fieldName: string,
): number {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "number" || !Number.isFinite(fieldValue)) {
    throw new Error(`monitor API field ${fieldName} must be a number`);
  }

  return fieldValue;
}

function booleanField(
  value: Record<string, unknown>,
  fieldName: string,
): boolean {
  const fieldValue = value[fieldName];

  if (typeof fieldValue !== "boolean") {
    throw new Error(`monitor API field ${fieldName} must be a boolean`);
  }

  return fieldValue;
}

function optionalNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
