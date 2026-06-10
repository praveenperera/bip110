import {
  ACTIVATION_THRESHOLD,
  formatInteger,
  formatPercent,
  jsonResponse,
  monitorDescription,
  readMonitorData,
} from "./monitor-data";
import { MONITOR_OG_IMAGE_PATH } from "./monitor-og-image";
import type { MonitorData, MonitorMetadata } from "./types";

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
    return rewriteMonitorPage(assetResponse, request, data);
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
): Response {
  const metadata = monitorMetadata(request, data);
  const transformed = new HTMLRewriter()
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
    .on("head", new HeadAppender(extraMetaTags(metadata)))
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

class HeadAppender implements HTMLRewriterElementContentHandlers {
  constructor(private readonly html: string) {}

  element(element: Element): void {
    element.append(this.html, { html: true });
  }
}
