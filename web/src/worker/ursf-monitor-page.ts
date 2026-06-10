import { ursfBlockGridHtml } from "./block-grid";
import {
  formatInteger,
  jsonResponse,
  PERIOD_SIZE,
  readMonitorData,
} from "./monitor-data";
import { readMonitorBlocks } from "./monitor-blocks";
import type { MonitorBlock, MonitorData } from "./types";

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
    const blocks = await readUrsfMonitorBlocks(request, ctx);
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
      "[data-ursf-block-grid]",
      new InnerHtmlRewriter(ursfBlockGridHtml(data, blocks)),
    )
    .transform(response);

  const headers = new Headers(transformed.headers);
  headers.set("cache-control", "no-store");
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
  ctx: ExecutionContext,
): Promise<MonitorBlock[]> {
  try {
    const payload = await readMonitorBlocks(request, ctx);
    return payload.blocks;
  } catch {
    return [];
  }
}

function staticUrsfMonitorPage(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("cache-control", "no-store");
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
    "history-all-end": formatInteger(data.tip),
    "history-all-start": formatInteger(previousPeriodStart),
    "history-all-tracked": formatInteger(data.tip - previousPeriodStart + 1),
    "history-current-end": formatInteger(data.periodEnd),
    "history-current-start": formatInteger(data.periodStart),
    "history-current-tracked": `${formatInteger(data.totalBlocks)} / ${formatInteger(PERIOD_SIZE)}`,
    "history-previous-end": formatInteger(previousPeriodEnd),
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
