import { bip110BlockGridHtml } from "./block-grid";
import {
  ACTIVATION_THRESHOLD,
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
    .on('meta[name="twitter:title"]', new MetaContentRewriter(metadata.title))
    .on(
      'meta[name="twitter:description"]',
      new MetaContentRewriter(metadata.description),
    )
    .on(
      'meta[name="twitter:image"]',
      new MetaContentRewriter(metadata.imageUrl),
    )
    .on("title", new InnerContentRewriter(metadata.title))
    .on("head", new HeadAppender(extraMetaTags(metadata)));

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
      "[data-monitor-block-grid]",
      new InnerHtmlRewriter(bip110BlockGridHtml(data, blocks)),
    )
    .transform(response);

  const headers = new Headers(transformed.headers);
  headers.set("cache-control", "no-store");
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
  headers.set("cache-control", "no-store");
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

function extraMetaTags(metadata: MonitorMetadata): string {
  return [
    metaProperty("og:image:type", "image/png"),
    metaProperty("og:image:alt", metadata.imageAlt),
    metaName("twitter:image:alt", metadata.imageAlt),
  ].join("");
}

function metaProperty(property: string, content: string): string {
  return `<meta property="${escapeHtmlAttribute(property)}" content="${escapeHtmlAttribute(content)}">`;
}

function metaName(name: string, content: string): string {
  return `<meta name="${escapeHtmlAttribute(name)}" content="${escapeHtmlAttribute(content)}">`;
}

function isHtmlResponse(response: Response): boolean {
  return response.headers.get("content-type")?.includes("text/html") ?? false;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
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

class HeadAppender implements HTMLRewriterElementContentHandlers {
  constructor(private readonly html: string) {}

  element(element: Element): void {
    element.append(this.html, { html: true });
  }
}

class StyleRewriter implements HTMLRewriterElementContentHandlers {
  constructor(private readonly style: string) {}

  element(element: Element): void {
    element.setAttribute("style", this.style);
  }
}
