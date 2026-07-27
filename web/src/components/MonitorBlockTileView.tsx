import { Tooltip } from "@base-ui/react/tooltip";
import { Sparkles } from "lucide-react";

import { type MonitorGridBlock } from "@/lib/monitor";
import { cn } from "@/lib/utils";
import {
  blockMinerLabel,
  dashboardBlockPresentation,
  type dashboardBlockPresentation as DashboardBlockPresentation,
} from "@/worker/BlockGrid.gen";
import type { attributionState as BlockMiningAttributionState } from "./MonitorDashboardUiController.gen";

const MEMPOOL_BLOCK_URL = "https://mempool.guide/block";

type MonitorBlockGridMode = "bip110" | "ursf";

function BlockTooltip({
  attributionState,
  block,
  mode,
  presentation,
}: {
  attributionState: BlockMiningAttributionState;
  block: MonitorGridBlock;
  mode: MonitorBlockGridMode;
  presentation: DashboardBlockPresentation;
}) {
  const attribution =
    attributionState.status === "loaded"
      ? (attributionState.attribution ?? null)
      : null;
  const minedBy =
    attributionState.status === "idle" || attributionState.status === "loading"
      ? "Loading…"
      : attributionState.status === "unavailable"
        ? "Unavailable"
        : blockMinerLabel(attribution);
  const violationCount = presentation.violationCount ?? null;

  return (
    <Tooltip.Popup
      className={cn(
        "z-50 w-[min(35rem,calc(100vw-2rem))] rounded-lg border px-3 py-2.5 font-mono text-xs leading-relaxed shadow-2xl",
        mode === "ursf"
          ? "ursf-tooltip"
          : "border-border bg-popover text-popover-foreground",
      )}
    >
      <dl className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-muted-foreground">Height</dt>
        <dd>{block.height}</dd>
        <dt className="text-muted-foreground">Hash</dt>
        <dd className="break-all">{presentation.hashLabel}</dd>
        <dt className="text-muted-foreground">Version</dt>
        <dd>{presentation.versionLabel}</dd>
        <dt className="text-muted-foreground">Time</dt>
        <dd>{presentation.timeLabel}</dd>
        <dt className="text-muted-foreground">Txs</dt>
        <dd>{presentation.transactionsLabel}</dd>
        <dt className="text-muted-foreground">Miner</dt>
        <dd>{presentation.known ? minedBy : "Unavailable"}</dd>
        {violationCount !== null ? (
          <>
            <dt className="text-muted-foreground">Clean</dt>
            <dd>{presentation.cleanLabel}</dd>
            <dt className="text-muted-foreground">Violations</dt>
            <dd>{presentation.violationCountLabel}</dd>
          </>
        ) : null}
      </dl>
      <p
        className={cn(
          "mt-3",
          mode === "bip110" && presentation.signaling
            ? "text-primary"
            : "text-muted-foreground",
        )}
      >
        {presentation.statusPrefix}
        {presentation.statusLabel}
      </p>
      {presentation.firstMinerSignal && (
        <p className="mt-2 font-sans text-xs font-semibold text-primary">
          First-ever BIP-110 signal from {blockMinerLabel(attribution)}
        </p>
      )}
    </Tooltip.Popup>
  );
}

/** Base UI tooltip adapter for one ReScript-owned monitor-grid cell */
export function MonitorBlockTileView({
  attributionForHash,
  block,
  mode,
  onAttributionOpen,
}: {
  attributionForHash: (hash: string) => BlockMiningAttributionState;
  block: MonitorGridBlock;
  mode: MonitorBlockGridMode;
  onAttributionOpen: (hash: string) => void;
}) {
  const presentation = dashboardBlockPresentation(block, mode);
  const blockHash = block.kind === "known" ? block.hash : null;
  const clientAttributionState = blockHash
    ? attributionForHash(blockHash)
    : { status: "idle" as const, attribution: null };
  const serverAttributionState = presentation.hasServerAttribution
    ? {
        status: "loaded" as const,
        attribution: presentation.serverAttribution ?? null,
      }
    : null;
  const attributionState = serverAttributionState ?? clientAttributionState;

  return (
    <Tooltip.Root
      onOpenChange={(open) => {
        if (open && blockHash && attributionState.status === "idle") {
          onAttributionOpen(blockHash);
        }
      }}
    >
      <Tooltip.Trigger
        delay={80}
        closeDelay={0}
        render={
          <a
            href={`${MEMPOOL_BLOCK_URL}/${block.height}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={presentation.title}
          />
        }
        className={cn(
          "relative flex h-12 items-center justify-center overflow-hidden rounded-md border px-2 font-mono text-sm font-semibold tracking-normal transition-[background-color,border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 focus-visible:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          mode === "ursf"
            ? "ursf-block-cell border-[var(--ursf-border)] bg-[var(--ursf-block)] text-[var(--ursf-block-text)] hover:bg-[var(--ursf-card-hover)]"
            : "border-border/60 bg-background/80 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
          presentation.signaling &&
            "bg-primary/10 text-primary shadow-[inset_0_-3px_0_var(--primary)] hover:bg-primary/15 hover:text-primary",
          presentation.clean && "border-primary/30 hover:border-primary/50",
          presentation.firstMinerSignal &&
            "bg-primary/20 text-primary ring-2 ring-primary/60 shadow-[inset_0_-3px_0_var(--primary),0_0_18px_color-mix(in_oklab,var(--primary)_45%,transparent)] hover:bg-primary/25",
        )}
      >
        {presentation.firstMinerSignal && (
          <>
            <span
              className="pointer-events-none absolute -right-2 -top-2 size-9 rounded-full bg-primary/35 blur-md motion-safe:animate-pulse"
              aria-hidden="true"
            />
            <Sparkles
              className="pointer-events-none absolute right-1 top-1 size-3 text-primary motion-safe:animate-pulse"
              aria-hidden="true"
            />
          </>
        )}
        <span className="relative z-10">{block.height}</span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner
          side="bottom"
          align="center"
          sideOffset={8}
          collisionPadding={16}
          positionMethod="fixed"
          collisionAvoidance={{ side: "flip", align: "shift" }}
        >
          <BlockTooltip
            attributionState={attributionState}
            block={block}
            mode={mode}
            presentation={presentation}
          />
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
