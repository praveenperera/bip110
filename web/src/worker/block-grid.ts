import {
  currentPeriodGrid,
  isCleanMonitorBlock,
  isFirstMinerSignal,
  MONITOR_GRID_VISIBLE_BLOCKS,
  type BlockMiningAttribution,
  type MonitorBlock,
  type MonitorData,
  type MonitorGridBlock,
} from "../lib/monitor";
import { formatInteger } from "./monitor-data";

const MEMPOOL_BLOCK_URL = "https://mempool.guide/block";

export function bip110BlockGridHtml(
  data: MonitorData,
  blocks: MonitorBlock[],
): string {
  const gridBlocks = gridBlocksFor(data, blocks);

  if (gridBlocks.length === 0) {
    return `<p class="col-span-full text-sm text-muted-foreground">No block snapshot available</p>`;
  }

  return gridBlocks.map((block) => bip110BlockLinkHtml(block)).join("");
}

export function ursfBlockGridHtml(
  data: MonitorData,
  blocks: MonitorBlock[],
): string {
  const gridBlocks = gridBlocksFor(data, blocks);

  if (gridBlocks.length === 0) {
    return `<p class="ursf-muted col-span-full text-sm">No block snapshot available</p>`;
  }

  return gridBlocks.map((block) => ursfBlockLinkHtml(block)).join("");
}

/** Renders the first-signal legend entry when a visible tile has that state */
export function bip110FirstSignalLegendHtml(
  data: MonitorData,
  blocks: MonitorBlock[],
): string {
  const hasFirstMinerSignal = gridBlocksFor(data, blocks).some(
    isFirstMinerSignal,
  );

  if (!hasFirstMinerSignal) return "";

  return [
    '<span class="inline-flex items-center gap-2">',
    '<span class="relative size-3 rounded-sm border border-primary bg-primary/20 ring-1 ring-primary/60" aria-hidden="true">',
    '<span class="absolute -right-1 -top-1 text-[0.625rem] leading-none text-primary">✦</span>',
    "</span>",
    "Miner's first-ever signal",
    "</span>",
  ].join("");
}

function gridBlocksFor(
  data: MonitorData,
  blocks: MonitorBlock[],
): MonitorGridBlock[] {
  return currentPeriodGrid(data, blocks).slice(0, MONITOR_GRID_VISIBLE_BLOCKS);
}

function bip110BlockLinkHtml(block: MonitorGridBlock): string {
  const firstMinerSignal = isFirstMinerSignal(block);
  const clean = block.kind === "known" && isCleanMonitorBlock(block);
  const className = [
    "relative flex h-12 items-center justify-center overflow-hidden rounded-md border px-2 font-mono text-sm font-semibold tracking-normal transition-colors",
    block.kind === "known" && block.signaling
      ? "bg-primary/10 text-primary shadow-[inset_0_-3px_0_var(--primary)]"
      : "bg-background/80 text-muted-foreground",
    clean ? "border-primary/30" : "border-border/60",
    firstMinerSignal
      ? "bg-primary/20 ring-2 ring-primary/60 shadow-[inset_0_-3px_0_var(--primary),0_0_18px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return blockLinkHtml({
    block,
    className,
    status:
      block.kind === "known" && block.signaling
        ? "SIGNALING BIP-110"
        : "not signaling",
    clean,
    firstMinerSignal,
    showCleanliness: true,
  });
}

function ursfBlockLinkHtml(block: MonitorGridBlock): string {
  const className = [
    "ursf-block-cell relative flex h-12 items-center justify-center overflow-hidden rounded-md border border-[var(--ursf-border)] bg-[var(--ursf-block)] px-2 font-mono text-sm font-semibold tracking-normal text-[var(--ursf-block-text)] transition-colors",
  ]
    .filter(Boolean)
    .join(" ");

  return blockLinkHtml({
    block,
    className,
    clean: false,
    status: "not signaling",
    firstMinerSignal: false,
    showCleanliness: false,
  });
}

function blockLinkHtml({
  block,
  className,
  clean,
  firstMinerSignal,
  showCleanliness,
  status,
}: {
  block: MonitorGridBlock;
  className: string;
  clean: boolean;
  firstMinerSignal: boolean;
  showCleanliness: boolean;
  status: string;
}): string {
  const miner =
    block.kind === "known" &&
    block.signaling &&
    block.signalingMiner.status === "identified"
      ? formatBlockMiner(block.signalingMiner.attribution)
      : null;
  const violationCount =
    showCleanliness &&
    block.kind === "known" &&
    block.bip110Violations.status === "known"
      ? block.bip110Violations.count
      : null;
  const title =
    block.kind === "known"
      ? [
          `Height ${formatInteger(block.height)}`,
          `Hash ${block.hash}`,
          `Version ${formatBlockVersion(block.version)}`,
          `Time ${formatBlockTime(block.time)}`,
          `Txs ${formatInteger(block.nTx)}`,
          miner ? `Miner ${miner}` : null,
          violationCount === null
            ? null
            : `Clean ${violationCount === 0 ? "Yes" : "No"}`,
          violationCount === null ? null : `Violations ${violationCount}`,
          status,
          firstMinerSignal ? `First-ever signal from ${miner}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : `Height ${formatInteger(block.height)}`;
  const flare = firstMinerSignal
    ? '<span aria-hidden="true" class="pointer-events-none absolute right-1 top-0.5 text-xs text-primary motion-safe:animate-pulse">✦</span>'
    : "";

  return `<a href="${MEMPOOL_BLOCK_URL}/${block.height}" target="_blank" rel="noopener noreferrer" class="${className}" title="${escapeAttribute(title)}">${flare}<span class="relative z-10">${formatInteger(block.height)}</span></a>`;
}

function formatBlockMiner(attribution: BlockMiningAttribution): string {
  if (!attribution.templateMinerName) return attribution.poolName;

  return `${attribution.poolName} (${attribution.templateMinerName})`;
}

function formatBlockVersion(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}

function formatBlockTime(value: number): string {
  return `${new Date(value * 1000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 16)} UTC`;
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
