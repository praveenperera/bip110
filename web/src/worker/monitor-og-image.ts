import { type MonitorData } from "../lib/monitor";
import {
  CACHE_TTL_SECONDS,
  defaultCache,
  jsonResponse,
  readMonitorData,
} from "./monitor-data";
import {
  hasImageParams,
  parseImageData,
  type imageParams as MonitorImageParams,
} from "./MonitorOgImageModel.gen";
import { render as renderMonitorOgPng } from "./MonitorOgRenderer.gen.ts";

export async function handleMonitorOgImageRequest(
  request: Request,
  ctx: ExecutionContext,
): Promise<Response> {
  const url = new URL(request.url);
  const imageParams = monitorImageParams(url);
  const parsedData = parseImageData(imageParams) ?? null;

  if (!parsedData && hasImageParams(imageParams)) {
    return jsonResponse(
      { error: "Invalid monitor image parameters" },
      {
        status: 400,
        headers: { "cache-control": "no-store" },
      },
    );
  }

  const cache = defaultCache();
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);

  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("x-bip110-og-cache", "HIT");

    return new Response(request.method === "HEAD" ? null : cached.body, {
      headers,
      status: cached.status,
      statusText: cached.statusText,
    });
  }

  const data = parsedData ?? (await readMonitorData(request, ctx));
  const png = await renderMonitorOgPng(data);
  const body = pngBody(png);
  const headers = new Headers({
    "cache-control": `public, max-age=${CACHE_TTL_SECONDS}`,
    "content-length": String(png.byteLength),
    "content-type": "image/png",
    "x-bip110-og-cache": "MISS",
  });
  const response = new Response(request.method === "HEAD" ? null : body, {
    headers,
  });
  const cacheResponse = new Response(pngBody(png), { headers });

  ctx.waitUntil(cache.put(cacheKey, cacheResponse).catch(() => {}));

  return response;
}

function pngBody(png: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(png.byteLength);
  new Uint8Array(buffer).set(png);

  return buffer;
}

function monitorImageParams(url: URL): MonitorImageParams {
  return {
    period: url.searchParams.get("period"),
    tip: url.searchParams.get("tip"),
    blocks: url.searchParams.get("blocks"),
    signals: url.searchParams.get("signals"),
    pct: url.searchParams.get("pct"),
    updated: url.searchParams.get("updated"),
  };
}
