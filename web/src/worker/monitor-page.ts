import { bip110BlockGridHtml } from "./block-grid";
import {
  ACTIVATION_THRESHOLD,
  CACHE_TTL_SECONDS,
  formatInteger,
  formatPercent,
  jsonResponse,
  monitorDescription,
  PERIOD_SIZE,
  readMonitorData,
} from "./monitor-data";
import { readMonitorBlocks } from "./monitor-blocks";
import { MONITOR_OG_IMAGE_PATH } from "./monitor-og-image";
import type { MonitorBlock, MonitorData, MonitorMetadata } from "./types";

export const MONITOR_PAGE_PATHS = new Set(["/monitor", "/monitor/"]);

const MONITOR_PAGE_ASSET_PATH = "/monitor/";

export async function handleMonitorPageRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: { allow: "GET, HEAD" },
      },
    );
  }

  const assetResponse = await fetchMonitorPageAsset(request, env);

  if (!assetResponse.ok || !isHtmlResponse(assetResponse)) {
    return assetResponse;
  }

  try {
    const data = await readMonitorData(request, ctx);
    const blocks = await readMonitorPageBlocks(request, ctx);
    return rewriteMonitorPage(assetResponse, request, data, blocks);
  } catch {
    return staticMonitorPage(assetResponse);
  }
}

function fetchMonitorPageAsset(request: Request, env: Env): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = MONITOR_PAGE_ASSET_PATH;
  assetUrl.search = "";

  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

function rewriteMonitorPage(
  response: Response,
  request: Request,
  data: MonitorData,
  blocks: MonitorBlock[],
): Response {
  const metadata = monitorMetadata(request, data);
  const fields = monitorPageFields(data);
  let rewriter = new HTMLRewriter()
    .on(
      'meta[name="description"]',
      new MetaContentRewriter(metadata.description),
    )
    .on('meta[property="og:title"]', new MetaContentRewriter(metadata.title))
    .on(
      'meta[property="og:description"]',
      new MetaContentRewriter(metadata.description),
    )
    .on(
      'meta[property="og:url"]',
      new MetaContentRewriter(metadata.canonicalUrl),
    )
    .on('meta[property="og:image"]', new MetaContentRewriter(metadata.imageUrl))
    .on(
      'meta[property="og:image:secure_url"]',
      new MetaContentRewriter(metadata.imageUrl),
    )
    .on('meta[property="og:image:type"]', new MetaContentRewriter("image/png"))
    .on(
      'meta[property="og:image:alt"]',
      new MetaContentRewriter(metadata.imageAlt),
    )
    .on('meta[name="twitter:title"]', new MetaContentRewriter(metadata.title))
    .on(
      'meta[name="twitter:description"]',
      new MetaContentRewriter(metadata.description),
    )
    .on(
      'meta[name="twitter:image"]',
      new MetaContentRewriter(metadata.imageUrl),
    )
    .on(
      'meta[name="twitter:image:alt"]',
      new MetaContentRewriter(metadata.imageAlt),
    )
    .on("title", new InnerContentRewriter(metadata.title));

  for (const [field, value] of Object.entries(fields)) {
    rewriter = rewriter.on(
      `[data-monitor-field="${field}"]`,
      new InnerContentRewriter(value),
    );
  }

  const transformed = rewriter
    .on(
      '[data-monitor-progress="activation"]',
      new StyleRewriter(
        `width: ${activationProgressPercent(data).toFixed(2)}%`,
      ),
    )
    .on(
      '[data-monitor-progress="period"]',
      new StyleRewriter(`width: ${periodProgressPercent(data).toFixed(2)}%`),
    )
    .on(
      "[data-monitor-period-chart]",
      new InnerHtmlRewriter(periodSignalingChartHtml(data)),
    )
    .on(
      "[data-monitor-block-grid]",
      new InnerHtmlRewriter(bip110BlockGridHtml(data, blocks)),
    )
    .transform(response);

  const headers = new Headers(transformed.headers);
  headers.set("cache-control", `public, max-age=${CACHE_TTL_SECONDS}`);
  headers.set("x-bip110-monitor-og", "dynamic");
  headers.delete("etag");

  return new Response(transformed.body, {
    headers,
    status: transformed.status,
    statusText: transformed.statusText,
  });
}

async function readMonitorPageBlocks(
  request: Request,
  ctx: ExecutionContext,
): Promise<MonitorBlock[]> {
  try {
    const payload = await readMonitorBlocks(request, ctx);
    return payload.blocks;
  } catch {
    return [];
  }
}

function monitorPageFields(data: MonitorData): Record<string, string> {
  const blocksLeft = Math.max(data.periodEnd - data.tip, 0);
  const requiredSignalBlocks = Math.ceil(
    PERIOD_SIZE * (ACTIVATION_THRESHOLD / 100),
  );
  const signalingDeficit = Math.max(
    requiredSignalBlocks - data.signalingCount,
    0,
  );
  const sortedPeriods = [...data.periods].sort(
    (a, b) => b.periodNum - a.periodNum,
  );
  const previousPeriod =
    sortedPeriods.find((period) => period.periodNum === data.periodNum - 1) ??
    sortedPeriods.find((period) => period.periodNum < data.periodNum);

  return {
    "blocks-left": formatInteger(blocksLeft),
    "blocks-left-detail": formatEstimatedTime(blocksLeft),
    "chain-tip": formatInteger(data.chainTip),
    "history-current-end": formatInteger(data.periodEnd),
    "history-current-percent": formatPercent(data.pct),
    "history-current-period": formatInteger(data.periodNum),
    "history-current-signaling": formatInteger(data.signalingCount),
    "history-current-start": formatInteger(data.periodStart),
    "history-current-tracked": `${formatInteger(data.totalBlocks)} / ${formatInteger(PERIOD_SIZE)}`,
    "history-previous-end": formatPeriodEnd(
      previousPeriod,
      data.periodStart - 1,
    ),
    "history-previous-percent": formatPeriodPercent(previousPeriod, 0),
    "history-previous-period": previousPeriod
      ? formatInteger(previousPeriod.periodNum)
      : "previous",
    "history-previous-signaling": formatPeriodSignaling(previousPeriod, 0),
    "history-previous-start": formatPeriodStart(
      previousPeriod,
      data.periodStart - PERIOD_SIZE,
    ),
    "history-previous-tracked": formatPeriodTracked(
      previousPeriod,
      PERIOD_SIZE,
    ),
    "indexed-tip": formatInteger(data.tip),
    "period-detail": `${formatInteger(blocksLeft)} blocks remain in this period`,
    "period-end": formatInteger(data.periodEnd),
    "period-num": formatInteger(data.periodNum),
    "period-progress": `${formatInteger(data.totalBlocks)} / ${formatInteger(PERIOD_SIZE)}`,
    "period-start": formatInteger(data.periodStart),
    "signal-rate": formatPercent(data.pct),
    "signaling-detail": [
      `${formatInteger(data.signalingCount)} signaling blocks`,
      `${formatInteger(signalingDeficit)} more needed for lock-in`,
    ].join(", "),
    signals: formatInteger(data.signalingCount),
    "sync-status": data.synced ? "Synced" : "Syncing",
    threshold: formatInteger(requiredSignalBlocks),
    "updated-at": formatUpdatedAt(data.updatedAt),
  };
}

function activationProgressPercent(data: MonitorData): number {
  return clampPercent((data.pct / ACTIVATION_THRESHOLD) * 100);
}

function periodProgressPercent(data: MonitorData): number {
  return clampPercent((data.totalBlocks / PERIOD_SIZE) * 100);
}

function periodSignalingChartHtml(data: MonitorData): string {
  const periods = chartPeriodsFor(data);

  if (periods.length === 0) {
    return [
      '<div class="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">',
      "No period history available for charting.",
      "</div>",
    ].join("");
  }

  const chartWidth = Math.max(640, periods.length * 76 + 88);
  const chartHeight = 288;
  const margin = { bottom: 58, left: 64, right: 24, top: 28 };
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const plotWidth = chartWidth - margin.left - margin.right;
  const maxValue =
    Math.max(...periods.map((period) => period.signalingCount), 0) + 5;
  const yTicks = Array.from(new Set([maxValue, Math.round(maxValue / 2), 0]));
  const points = periods.map((period, index) => ({
    period,
    x: periodChartX(index, periods.length, margin.left, plotWidth),
    y: periodChartY(period.signalingCount, maxValue, margin.top, plotHeight),
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const yTickHtml = yTicks
    .map((tick) => {
      const y = periodChartY(tick, maxValue, margin.top, plotHeight);

      return [
        "<g>",
        `<line x1="${margin.left}" x2="${chartWidth - margin.right}" y1="${y}" y2="${y}" stroke="currentColor" stroke-opacity="0.16" />`,
        `<text x="${margin.left - 12}" y="${y + 4}" text-anchor="end" class="fill-current font-mono text-[11px]">${formatInteger(tick)}</text>`,
        "</g>",
      ].join("");
    })
    .join("");
  const pointHtml = points
    .map(({ period, x, y }) => {
      const isCurrentPeriod = period.periodNum === data.periodNum;
      const tooltipAbove = y > margin.top + 42;
      const tooltipY = tooltipAbove ? y - 40 : y + 14;
      const tooltipTextY = tooltipAbove ? y - 23 : y + 31;
      const currentLabel = isCurrentPeriod
        ? `<text x="${x}" y="${chartHeight - 14}" text-anchor="middle" class="fill-primary text-[10px] font-medium">current</text>`
        : "";
      const title = escapeHtml(
        [
          `Period ${period.periodNum}: ${formatSignalingBlockCount(period.signalingCount)}`,
          `(${formatPercent(period.pct)})`,
        ].join(" "),
      );
      const ariaLabel = escapeHtml(
        `Period ${period.periodNum}: ${formatSignalingBlockCount(period.signalingCount)}, ${formatPercent(period.pct)}`,
      );

      return [
        `<g aria-label="${ariaLabel}" class="period-chart-point outline-none" role="img" tabindex="0">`,
        `<title>${title}</title>`,
        `<circle cx="${x}" cy="${y}" r="${isCurrentPeriod ? "5.5" : "4.5"}" class="transition-[r,fill] duration-150" fill="var(--primary)" stroke="var(--background)" stroke-width="3" />`,
        '<g class="period-chart-tooltip">',
        `<rect x="${x - 34}" y="${tooltipY}" width="68" height="24" rx="6" class="fill-popover stroke-border" />`,
        `<text x="${x}" y="${tooltipTextY}" text-anchor="middle" class="fill-popover-foreground font-mono text-[11px]">${formatPercent(period.pct)}</text>`,
        "</g>",
        `<text x="${x}" y="${Math.max(y - 12, 14)}" text-anchor="middle" class="fill-current font-mono text-[11px]">${formatInteger(period.signalingCount)}</text>`,
        `<text x="${x}" y="${chartHeight - 31}" text-anchor="middle" class="fill-current font-mono text-[11px]">${period.periodNum}</text>`,
        currentLabel,
        "</g>",
      ].join("");
    })
    .join("");

  return [
    '<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">',
    "<div>",
    '<h3 class="text-base font-semibold tracking-tight">Signaling blocks by period</h3>',
    '<p class="mt-1 text-sm text-muted-foreground">The line charts the signaling count from the period history table.</p>',
    "</div>",
    '<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">',
    '<span class="inline-flex items-center gap-2"><span class="size-3 rounded-full border-2 border-primary bg-background" aria-hidden="true"></span>Signaling blocks</span>',
    "</div>",
    "</div>",
    `<div class="mt-5 overflow-x-auto" role="img" aria-label="Signaling block counts by difficulty adjustment period. Chart maximum is ${formatInteger(maxValue)} signaling blocks.">`,
    '<div class="w-max">',
    `<svg class="max-w-none text-muted-foreground" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}">`,
    yTickHtml,
    `<line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${margin.top + plotHeight}" stroke="currentColor" stroke-opacity="0.28" />`,
    `<line x1="${margin.left}" x2="${chartWidth - margin.right}" y1="${margin.top + plotHeight}" y2="${margin.top + plotHeight}" stroke="currentColor" stroke-opacity="0.28" />`,
    `<path d="${linePath}" fill="none" stroke="var(--primary)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" />`,
    pointHtml,
    "</svg>",
    `<p class="text-left text-[11px] text-muted-foreground" style="padding-left: ${margin.left}px; padding-right: ${margin.right}px;">difficulty adjustment period</p>`,
    "</div>",
    "</div>",
  ].join("");
}

function chartPeriodsFor(data: MonitorData): MonitorData["periods"] {
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
    .sort((a, b) => a.periodNum - b.periodNum);

  return [...previousPeriods, currentPeriod];
}

function periodChartY(
  value: number,
  maxValue: number,
  top: number,
  height: number,
): number {
  return top + height - (value / maxValue) * height;
}

function periodChartX(
  index: number,
  pointCount: number,
  left: number,
  width: number,
): number {
  if (pointCount === 1) {
    return left + width / 2;
  }

  return left + (width / (pointCount - 1)) * index;
}

function clampPercent(value: number): number {
  return Math.min(Math.max(value, 0), 100);
}

function formatPeriodStart(
  period: MonitorData["periods"][number] | undefined,
  fallback: number,
): string {
  return formatInteger(period?.startBlock ?? fallback);
}

function formatPeriodEnd(
  period: MonitorData["periods"][number] | undefined,
  fallback: number,
): string {
  return formatInteger(period?.endBlock ?? fallback);
}

function formatPeriodTracked(
  period: MonitorData["periods"][number] | undefined,
  fallback: number,
): string {
  return `${formatInteger(period?.totalBlocks ?? fallback)} / ${formatInteger(PERIOD_SIZE)}`;
}

function formatPeriodSignaling(
  period: MonitorData["periods"][number] | undefined,
  fallback: number,
): string {
  return formatInteger(period?.signalingCount ?? fallback);
}

function formatSignalingBlockCount(value: number): string {
  return `${formatInteger(value)} signaling ${value === 1 ? "block" : "blocks"}`;
}

function formatPeriodPercent(
  period: MonitorData["periods"][number] | undefined,
  fallback: number,
): string {
  return formatPercent(period?.pct ?? fallback);
}

function formatEstimatedTime(blocks: number): string {
  const minutes = blocks * 10;
  const days = minutes / 1440;

  if (days >= 2) {
    return `~${days.toFixed(days >= 10 ? 0 : 1)} days`;
  }

  const hours = minutes / 60;

  if (hours >= 1) {
    return `~${hours.toFixed(hours >= 10 ? 0 : 1)} hours`;
  }

  return `~${minutes} minutes`;
}

function formatUpdatedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
    year: "numeric",
  }).format(date);
}

function staticMonitorPage(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, max-age=${CACHE_TTL_SECONDS}`);
  headers.set("x-bip110-monitor-og", "static");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function monitorMetadata(request: Request, data: MonitorData): MonitorMetadata {
  const pct = formatPercent(data.pct);
  const canonicalUrl = new URL("/monitor/", request.url).href;
  const imageUrl = monitorImageUrl(request, data);

  return {
    title: `BIP-110 Monitor: ${pct} signaling`,
    description: monitorDescription(data),
    imageAlt: [
      `BIP-110 signaling status: ${pct}`,
      `${formatInteger(data.signalingCount)} of ${formatInteger(data.totalBlocks)} blocks`,
      `in period ${data.periodNum}`,
      `${ACTIVATION_THRESHOLD}% activation target`,
    ].join(", "),
    imageUrl,
    canonicalUrl,
  };
}

function monitorImageUrl(request: Request, data: MonitorData): string {
  const url = new URL(MONITOR_OG_IMAGE_PATH, request.url);
  url.searchParams.set("period", String(data.periodNum));
  url.searchParams.set("tip", String(data.tip));
  url.searchParams.set("blocks", String(data.totalBlocks));
  url.searchParams.set("signals", String(data.signalingCount));
  url.searchParams.set("pct", data.pct.toFixed(2));
  url.searchParams.set("updated", data.updatedAt);

  return url.href;
}

function isHtmlResponse(response: Response): boolean {
  return response.headers.get("content-type")?.includes("text/html") ?? false;
}

class MetaContentRewriter implements HTMLRewriterElementContentHandlers {
  constructor(private readonly content: string) {}

  element(element: Element): void {
    element.setAttribute("content", this.content);
  }
}

class InnerContentRewriter implements HTMLRewriterElementContentHandlers {
  constructor(private readonly content: string) {}

  element(element: Element): void {
    element.setInnerContent(this.content);
  }
}

class InnerHtmlRewriter implements HTMLRewriterElementContentHandlers {
  constructor(private readonly html: string) {}

  element(element: Element): void {
    element.setInnerContent(this.html, { html: true });
  }
}

class StyleRewriter implements HTMLRewriterElementContentHandlers {
  constructor(private readonly style: string) {}

  element(element: Element): void {
    element.setAttribute("style", this.style);
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
