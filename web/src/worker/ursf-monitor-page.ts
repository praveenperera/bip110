import { ursfBlockGridHtml } from "./BlockGrid.gen.ts";
import { type MonitorBlock, type MonitorData } from "../lib/monitor";
import { CACHE_TTL_SECONDS, readMonitorData } from "./monitor-data";
import { readMonitorBlocks } from "./monitor-blocks";
import {
  historyTableRowsHtml,
  monitorFields,
  periodChartHtml,
  periodProgressPercent,
} from "./UrsfPageModel.gen.ts";

const URSF_MONITOR_PAGE_ASSET_PATH = "/ursf-monitor/";

export async function handleUrsfMonitorPageRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
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
  const fields = monitorFields(data);
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
      new InnerHtmlRewriter(periodChartHtml(data)),
    )
    .on(
      "[data-ursf-history-body]",
      new InnerHtmlRewriter(historyTableRowsHtml(data)),
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
