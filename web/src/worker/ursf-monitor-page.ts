import { CACHE_TTL_SECONDS } from "./monitor-data.ts";

const URSF_MONITOR_PAGE_ASSET_PATH = "/ursf-monitor/";

export async function handleUrsfMonitorPageRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const assetResponse = await fetchUrsfMonitorPageAsset(request, env);

  if (!assetResponse.ok || !isHtmlResponse(assetResponse)) {
    return assetResponse;
  }

  return staticUrsfMonitorPage(assetResponse);
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
