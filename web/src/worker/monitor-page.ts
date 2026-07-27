import {
  bip110BlockGridHtml,
  bip110FirstSignalLegendHtml,
} from "./BlockGrid.gen.ts";
import { type MonitorBlock, type MonitorData } from "../lib/monitor";
import { shouldShowMandatorySignaling } from "../lib/MandatorySignaling.gen";
import { CACHE_TTL_SECONDS, readMonitorData } from "./monitor-data";
import { readMonitorBlocks } from "./monitor-blocks";
import {
  parseRecentWindow,
  recentWindowParam as RECENT_WINDOW_PARAM,
} from "../lib/RecentSignaling.gen";
import { monitorOgImagePath } from "./WorkerRouter.gen.ts";
import {
  activationProgressPercent,
  monitorMetadataText,
  monitorPageFields,
  monitorSyncStatus,
  periodSignalingChartHtml as rescriptPeriodSignalingChartHtml,
  periodProgressPercent,
} from "./MonitorPageModel.gen.ts";

const MONITOR_PAGE_ASSET_PATH = "/monitor/";

interface MonitorMetadata {
  title: string;
  description: string;
  imageAlt: string;
  imageUrl: string;
  canonicalUrl: string;
}

export async function handleMonitorPageRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const assetResponse = await fetchMonitorPageAsset(request, env);

  if (!assetResponse.ok || !isHtmlResponse(assetResponse)) {
    return assetResponse;
  }

  try {
    const data = await readMonitorData(request, ctx);
    const blocks = await readMonitorPageBlocks(request, env, ctx, data.tip);
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
  const syncStatus = monitorSyncStatus(data);
  const recentWindow = parseRecentWindow(
    new URL(request.url).searchParams.get(RECENT_WINDOW_PARAM),
  );
  const fields = monitorPageFields(data, blocks, recentWindow, Date.now());
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

  if (!shouldShowMandatorySignaling(data.tip)) {
    rewriter = rewriter.on(
      "[data-monitor-mandatory-signaling]",
      new RemoveElementRewriter(),
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
      "[data-monitor-sync-status]",
      new ClassRewriter(
        syncStatus ? "font-medium text-sm text-primary" : "hidden",
      ),
    )
    .on(
      "[data-monitor-period-chart]",
      new InnerHtmlRewriter(rescriptPeriodSignalingChartHtml(data)),
    )
    .on(
      "[data-monitor-block-grid]",
      new InnerHtmlRewriter(bip110BlockGridHtml(data, blocks)),
    )
    .on(
      "[data-monitor-first-signal-key]",
      new InnerHtmlRewriter(bip110FirstSignalLegendHtml(data, blocks)),
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
  const text = monitorMetadataText(data);
  const canonicalUrl = new URL("/monitor/", request.url).href;
  const imageUrl = monitorImageUrl(request, data);

  return {
    ...text,
    imageUrl,
    canonicalUrl,
  };
}

function monitorImageUrl(request: Request, data: MonitorData): string {
  const url = new URL(monitorOgImagePath, request.url);
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

class ClassRewriter implements HTMLRewriterElementContentHandlers {
  constructor(private readonly className: string) {}

  element(element: Element): void {
    element.setAttribute("class", this.className);
  }
}

class RemoveElementRewriter implements HTMLRewriterElementContentHandlers {
  element(element: Element): void {
    element.remove();
  }
}
