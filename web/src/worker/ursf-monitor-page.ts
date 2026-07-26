import { ursfBlockGridHtml } from "./block-grid";
import {
  PERIOD_SIZE,
  type MonitorBlock,
  type MonitorData,
} from "../lib/monitor";
import {
  CACHE_TTL_SECONDS,
  formatInteger,
  formatPercent,
  jsonResponse,
  readMonitorData,
} from "./monitor-data";
import { readMonitorBlocks } from "./monitor-blocks";

export const URSF_MONITOR_PAGE_PATHS = new Set([
  "/ursf-monitor",
  "/ursf-monitor/",
]);

const URSF_MONITOR_PAGE_ASSET_PATH = "/ursf-monitor/";

export async function handleUrsfMonitorPageRequest(
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

  const assetResponse = await fetchUrsfMonitorPageAsset(request, env);

  if (!assetResponse.ok || !isHtmlResponse(assetResponse)) {
    return assetResponse;
  }

  try {
    const data = await readMonitorData(request, ctx);
    const blocks = await readUrsfMonitorBlocks(request, env, ctx, data.tip);
    return rewriteUrsfMonitorPage(assetResponse, data, blocks);
  } catch {
    return staticUrsfMonitorPage(assetResponse);
  }
}

function fetchUrsfMonitorPageAsset(
  request: Request,
  env: Env,
): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = URSF_MONITOR_PAGE_ASSET_PATH;
  assetUrl.search = "";

  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
}

function rewriteUrsfMonitorPage(
  response: Response,
  data: MonitorData,
  blocks: MonitorBlock[],
): Response {
  const fields = ursfMonitorFields(data);
  let rewriter = new HTMLRewriter();

  for (const [field, value] of Object.entries(fields)) {
    rewriter = rewriter.on(
      `[data-ursf-field="${field}"]`,
      new InnerContentRewriter(value),
    );
  }

  const transformed = rewriter
    .on(
      '[data-ursf-progress="period"]',
      new StyleRewriter(`width: ${periodProgressPercent(data).toFixed(2)}%`),
    )
    .on(
      "[data-ursf-period-chart]",
      new InnerHtmlRewriter(ursfPeriodChartHtml(data)),
    )
    .on(
      "[data-ursf-history-body]",
      new InnerHtmlRewriter(ursfHistoryTableRowsHtml(data)),
    )
    .on(
      "[data-ursf-block-grid]",
      new InnerHtmlRewriter(ursfBlockGridHtml(data, blocks)),
    )
    .transform(response);

  const headers = new Headers(transformed.headers);
  headers.set("cache-control", `public, max-age=${CACHE_TTL_SECONDS}`);
  headers.set("x-bip110-ursf-monitor", "dynamic");
  headers.delete("etag");

  return new Response(transformed.body, {
    headers,
    status: transformed.status,
    statusText: transformed.statusText,
  });
}

async function readUrsfMonitorBlocks(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  expectedTip: number,
): Promise<MonitorBlock[]> {
  try {
    const payload = await readMonitorBlocks(request, env, ctx, expectedTip);
    return payload.blocks;
  } catch {
    return [];
  }
}

function staticUrsfMonitorPage(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", `public, max-age=${CACHE_TTL_SECONDS}`);
  headers.set("x-bip110-ursf-monitor", "static");

  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

function ursfMonitorFields(data: MonitorData): Record<string, string> {
  const blocksLeft = Math.max(data.periodEnd - data.tip, 0);
  const previousPeriodStart = data.periodStart - PERIOD_SIZE;
  const previousPeriodEnd = data.periodStart - 1;

  return {
    "blocks-left": formatInteger(blocksLeft),
    "blocks-left-detail": formatEstimatedTime(blocksLeft),
    "chain-tip": formatInteger(data.chainTip),
    "chain-tip-detail": "Latest Bitcoin chain height",
    "history-current-end": formatInteger(data.periodEnd),
    "history-current-period": formatInteger(data.periodNum),
    "history-current-start": formatInteger(data.periodStart),
    "history-current-tracked": `${formatInteger(data.totalBlocks)} / ${formatInteger(PERIOD_SIZE)}`,
    "history-previous-end": formatInteger(previousPeriodEnd),
    "history-previous-period": formatInteger(data.periodNum - 1),
    "history-previous-start": formatInteger(previousPeriodStart),
    "history-previous-tracked": `${formatInteger(PERIOD_SIZE)} / ${formatInteger(PERIOD_SIZE)}`,
    "indexed-tip": formatInteger(data.tip),
    "indexed-tip-detail": "Current Bitcoin block height",
    "period-end": formatInteger(data.periodEnd),
    "period-num": formatInteger(data.periodNum),
    "period-progress": `${formatInteger(data.totalBlocks)} / ${formatInteger(PERIOD_SIZE)}`,
    "period-start": formatInteger(data.periodStart),
    "status-period": formatInteger(data.periodNum),
  };
}

function periodProgressPercent(data: MonitorData): number {
  return Math.min(Math.max((data.totalBlocks / PERIOD_SIZE) * 100, 0), 100);
}

function ursfHistoryPeriods(data: MonitorData): MonitorData["periods"] {
  const currentPeriod = {
    periodNum: data.periodNum,
    startBlock: data.periodStart,
    endBlock: data.periodEnd,
    signalingCount: 0,
    totalBlocks: data.totalBlocks,
    pct: 0,
  };
  const previousPeriods = data.periods
    .filter((period) => period.periodNum !== data.periodNum)
    .map((period) => ({
      ...period,
      pct: 0,
      signalingCount: 0,
    }))
    .sort((a, b) => b.periodNum - a.periodNum);

  return [currentPeriod, ...previousPeriods];
}

function ursfHistoryTableRowsHtml(data: MonitorData): string {
  return ursfHistoryPeriods(data)
    .map((period) => {
      const isCurrentPeriod = period.periodNum === data.periodNum;
      const rowClass = isCurrentPeriod ? ' class="ursf-current-period"' : "";
      const currentBadge = isCurrentPeriod
        ? '<span class="ursf-current-badge inline-flex h-5 items-center rounded-full border px-2 text-[0.7rem] font-medium leading-none">Current</span>'
        : "";

      return [
        `<tr${rowClass}>`,
        '<td class="ursf-heading py-3 pl-4 pr-4 font-medium">',
        '<div class="flex flex-wrap items-center gap-2">',
        `<span>${formatInteger(period.periodNum)}</span>`,
        currentBadge,
        "</div>",
        "</td>",
        `<td class="ursf-muted py-3 pr-4 font-mono">${formatInteger(period.startBlock)}</td>`,
        `<td class="ursf-muted py-3 pr-4 font-mono">${formatInteger(period.endBlock)}</td>`,
        `<td class="ursf-muted py-3 pr-4 font-mono">${formatInteger(period.totalBlocks)} / ${formatInteger(PERIOD_SIZE)}</td>`,
        '<td class="ursf-alert py-3 pr-4 font-mono font-semibold">0</td>',
        '<td class="ursf-alert py-3 font-mono font-semibold">0.00%</td>',
        "</tr>",
      ].join("");
    })
    .join("");
}

function ursfPeriodChartHtml(data: MonitorData): string {
  const periods = [...ursfHistoryPeriods(data)].sort(
    (a, b) => a.periodNum - b.periodNum,
  );

  if (periods.length === 0) {
    return [
      '<div class="ursf-muted rounded-lg border border-dashed border-[var(--ursf-border)] bg-[var(--ursf-soft)] p-6 text-sm">',
      "No period history available for charting.",
      "</div>",
    ].join("");
  }

  const chartWidth = Math.max(1440, periods.length * 160 + 160);
  const chartHeight = 288;
  const margin = { bottom: 58, left: 64, right: 24, top: 28 };
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const plotWidth = chartWidth - margin.left - margin.right;
  const maxValue = 5;
  const yTicks = [maxValue, Math.round(maxValue / 2), 0];
  const pointY = margin.top + plotHeight;
  const points = periods.map((period, index) => ({
    period,
    x: periodChartX(index, periods.length, margin.left, plotWidth),
  }));
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${pointY}`)
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
    .map(({ period, x }) => {
      const isCurrentPeriod = period.periodNum === data.periodNum;
      const title = escapeHtml(
        [
          `Period ${period.periodNum}: 0 signaling blocks`,
          `(${formatPercent(0)})`,
        ].join(" "),
      );
      const currentLabel = isCurrentPeriod
        ? `<text x="${x}" y="${chartHeight - 14}" text-anchor="middle" class="fill-[var(--ursf-alert)] text-[10px] font-medium">current</text>`
        : "";

      return [
        `<g aria-label="${title}" class="period-chart-point outline-none" role="img" tabindex="0">`,
        `<title>${title}</title>`,
        `<circle cx="${x}" cy="${pointY}" r="${isCurrentPeriod ? "5.5" : "4.5"}" class="transition-[r,fill] duration-150" fill="var(--ursf-alert)" stroke="var(--ursf-bg)" stroke-width="3" />`,
        '<g class="period-chart-tooltip">',
        `<rect x="${x - 34}" y="${pointY - 40}" width="68" height="24" rx="6" class="fill-[var(--ursf-card)] stroke-[var(--ursf-border)]" />`,
        `<text x="${x}" y="${pointY - 23}" text-anchor="middle" class="fill-[var(--ursf-heading)] font-mono text-[11px]">0.00%</text>`,
        "</g>",
        `<text x="${x}" y="${pointY - 12}" text-anchor="middle" class="fill-current font-mono text-[11px]">0</text>`,
        `<text x="${x}" y="${chartHeight - 31}" text-anchor="middle" class="fill-current font-mono text-[11px]">${formatInteger(period.periodNum)}</text>`,
        currentLabel,
        "</g>",
      ].join("");
    })
    .join("");

  return [
    '<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">',
    "<div>",
    '<h3 class="ursf-heading text-base font-semibold tracking-tight">URSF blocks by period</h3>',
    '<p class="ursf-muted mt-1 text-sm">The line remains at zero because no URSF signaling blocks are tracked.</p>',
    "</div>",
    '<div class="ursf-muted flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">',
    '<span class="inline-flex items-center gap-2"><span class="size-3 rounded-full border-2 border-[var(--ursf-alert)] bg-[var(--ursf-bg)]" aria-hidden="true"></span>URSF blocks</span>',
    "</div>",
    "</div>",
    `<div class="ursf-muted mt-5 overflow-x-auto" role="img" aria-label="URSF block counts by difficulty adjustment period. Chart maximum is ${formatInteger(maxValue)} blocks.">`,
    '<div class="w-max">',
    `<svg class="max-w-none" width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}">`,
    yTickHtml,
    `<line x1="${margin.left}" x2="${margin.left}" y1="${margin.top}" y2="${margin.top + plotHeight}" stroke="currentColor" stroke-opacity="0.28" />`,
    `<line x1="${margin.left}" x2="${chartWidth - margin.right}" y1="${margin.top + plotHeight}" y2="${margin.top + plotHeight}" stroke="currentColor" stroke-opacity="0.28" />`,
    `<path d="${linePath}" fill="none" stroke="var(--ursf-alert)" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" />`,
    pointHtml,
    "</svg>",
    '<p class="text-center text-[11px]">difficulty adjustment period</p>',
    "</div>",
    "</div>",
  ].join("");
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

function isHtmlResponse(response: Response): boolean {
  return response.headers.get("content-type")?.includes("text/html") ?? false;
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
