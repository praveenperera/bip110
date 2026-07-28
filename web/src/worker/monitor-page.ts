import { CACHE_TTL_SECONDS } from "./monitor-data.ts";

const MONITOR_PAGE_ASSET_PATH = "/monitor/";

export async function handleMonitorPageRequest(
  request: Request,
  env: Env,
  _ctx: ExecutionContext,
): Promise<Response> {
  const assetResponse = await fetchMonitorPageAsset(request, env);

  if (!assetResponse.ok || !isHtmlResponse(assetResponse)) {
    return assetResponse;
  }

  return staticMonitorPage(assetResponse);
}

function fetchMonitorPageAsset(request: Request, env: Env): Promise<Response> {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = MONITOR_PAGE_ASSET_PATH;
  assetUrl.search = "";

  return env.ASSETS.fetch(new Request(assetUrl.toString(), request));
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

function isHtmlResponse(response: Response): boolean {
  return response.headers.get("content-type")?.includes("text/html") ?? false;
}
