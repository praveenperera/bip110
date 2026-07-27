import {
  currentPeriodGrid as rescriptCurrentPeriodGrid,
  isCleanMonitorBlock as rescriptIsCleanMonitorBlock,
  isFirstMinerSignal as rescriptIsFirstMinerSignal,
  isReasonableMonitorData,
  monitorGridVisibleBlocks,
  parseBip110BlockViolationReport,
  parseBlockMiningAttribution as rescriptParseBlockMiningAttribution,
  parseMonitorBlocksPayload as rescriptParseMonitorBlocksPayload,
  parseMonitorData,
  periodSize,
  signalingMinerId as rescriptSignalingMinerId,
  type blockMiningAttribution,
  type monitorData,
  type monitorPeriod,
  type unclassifiedMonitorBlock,
} from "./Monitor.gen.ts";

/** Number of blocks in one difficulty adjustment period */
export const PERIOD_SIZE = periodSize;

/** Number of recent blocks shown before the monitor grid is expanded */
export const MONITOR_GRID_VISIBLE_BLOCKS = monitorGridVisibleBlocks;

/** Signaling summary for one difficulty adjustment period */
export type MonitorPeriod = monitorPeriod;

/** Normalized monitor snapshot consumed by browser and Worker renderers */
export type MonitorData = monitorData;

/** Block details discovered from the upstream monitor */
export type UnclassifiedMonitorBlock = unclassifiedMonitorBlock;

/** Mining attribution reported by the block explorer */
export interface BlockMiningAttribution {
  poolName: string;
  poolSlug: string | null;
  templateMinerName: string | null;
}

/** Miner discovery attached to a signaling block */
export type SignalingMinerDiscovery =
  | {
      status: "identified";
      attribution: BlockMiningAttribution;
      firstSignal: boolean;
    }
  | { status: "unidentified" }
  | { status: "unavailable" };

/** Known BIP-110 violations or an unavailable classification */
export type Bip110ViolationStatus =
  | { status: "known"; count: number }
  | { status: "unavailable" };

/** BIP-110 violation data attributed to one block */
export interface Bip110BlockViolationReport {
  hash: string;
  height: number;
  violations: Extract<Bip110ViolationStatus, { status: "known" }>;
}

/** Known block details returned by the monitor blocks API */
export type MonitorBlock = UnclassifiedMonitorBlock & {
  bip110Violations: Bip110ViolationStatus;
} & (
    | { signaling: true; signalingMiner: SignalingMinerDiscovery }
    | { signaling: false; signalingMiner: null }
  );

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

/** Parses mining attribution from a mempool-compatible block response */
export function parseBlockMiningAttribution(
  value: unknown,
): BlockMiningAttribution | null {
  const attribution = rescriptParseBlockMiningAttribution(value);

  if (!attribution) return null;

  return {
    poolName: attribution.poolName,
    poolSlug: attribution.poolSlug ?? null,
    templateMinerName: attribution.templateMinerName ?? null,
  };
}

/** Returns whether a classified block has zero BIP-110 violations */
export function isCleanMonitorBlock(block: MonitorBlock): boolean {
  return rescriptIsCleanMonitorBlock(block);
}

/** Returns whether a grid block is a miner's first identified signal */
export function isFirstMinerSignal(block: MonitorGridBlock): boolean {
  return rescriptIsFirstMinerSignal(block);
}

/** Returns the stable identity used to track a miner's first signal */
export function signalingMinerId(
  attribution: BlockMiningAttribution,
): string | null {
  return (
    rescriptSignalingMinerId(attribution as blockMiningAttribution) ?? null
  );
}

/** Parses an external monitor blocks payload */
export function parseMonitorBlocksPayload(
  value: unknown,
): MonitorBlocksPayload {
  return rescriptParseMonitorBlocksPayload(value) as MonitorBlocksPayload;
}

/** Builds current-period grid cells with explicit known and placeholder states */
export function currentPeriodGrid(
  data: MonitorData,
  blocks: readonly MonitorBlock[] | null,
): MonitorGridBlock[] {
  return rescriptCurrentPeriodGrid(
    data,
    blocks ? [...blocks] : null,
  ) as MonitorGridBlock[];
}

export {
  isReasonableMonitorData,
  parseBip110BlockViolationReport,
  parseMonitorData,
};
