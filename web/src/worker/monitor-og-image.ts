import {
  ACTIVATION_THRESHOLD,
  CACHE_TTL_SECONDS,
  PERIOD_SIZE,
  defaultCache,
  formatInteger,
  formatPercent,
  isReasonableMonitorData,
  jsonResponse,
  readMonitorData,
} from "./monitor-data";
import {
  type Color,
  createRaster,
  drawRightText,
  drawText,
  encodePng,
  fillRect,
  strokeRect,
} from "./png";
import type { MonitorData } from "./types";

export const MONITOR_OG_IMAGE_PATH = "/og/monitor.png";

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

const colors = {
  background: [7, 10, 15],
  panel: [14, 20, 30],
  panelSoft: [19, 28, 42],
  border: [39, 52, 76],
  orange: [247, 147, 26],
  orangeMuted: [145, 87, 26],
  blue: [88, 166, 255],
  text: [248, 250, 252],
  muted: [137, 148, 166],
  dim: [78, 89, 108],
} satisfies Record<string, Color>;

const imageParamNames = ["period", "tip", "blocks", "signals", "pct"];

export async function handleMonitorOgImageRequest(
  request: Request,
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

  const url = new URL(request.url);
  const parsedData = parseMonitorImageData(url);

  if (!parsedData && hasMonitorImageParams(url)) {
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

function parseMonitorImageData(url: URL): MonitorData | null {
  if (!hasMonitorImageParams(url)) {
    return null;
  }

  const periodNum = integerParam(url, "period");
  const tip = integerParam(url, "tip");
  const totalBlocks = integerParam(url, "blocks");
  const signalingCount = integerParam(url, "signals");
  const pct = numberParam(url, "pct");

  if (
    periodNum === null ||
    tip === null ||
    totalBlocks === null ||
    signalingCount === null ||
    pct === null
  ) {
    return null;
  }

  const periodStart = periodNum * PERIOD_SIZE;
  const data = {
    bip: "110",
    tip,
    chainTip: tip,
    periodNum,
    periodStart,
    periodEnd: periodStart + PERIOD_SIZE - 1,
    totalBlocks,
    signalingCount,
    pct,
    periods: [],
    synced: true,
    updatedAt: url.searchParams.get("updated") ?? new Date(0).toISOString(),
  };

  return isReasonableMonitorData(data) ? data : null;
}

function hasMonitorImageParams(url: URL): boolean {
  return imageParamNames.some((name) => url.searchParams.has(name));
}

function integerParam(url: URL, name: string): number | null {
  const value = url.searchParams.get(name);

  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isSafeInteger(parsed) ? parsed : null;
}

function numberParam(url: URL, name: string): number | null {
  const value = url.searchParams.get(name);

  if (value === null || !/^\d+(\.\d+)?$/.test(value)) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : null;
}

async function renderMonitorOgPng(data: MonitorData): Promise<Uint8Array> {
  const raster = createRaster(
    OG_IMAGE_WIDTH,
    OG_IMAGE_HEIGHT,
    colors.background,
  );
  const pct = Math.min(Math.max(data.pct, 0), 100);
  const periodProgress = Math.min(data.totalBlocks / PERIOD_SIZE, 1);
  const signalWidth = Math.round((pct / 100) * 980);
  const visibleSignalWidth =
    data.signalingCount > 0 ? Math.max(signalWidth, 6) : signalWidth;
  const thresholdX = 110 + Math.round((ACTIVATION_THRESHOLD / 100) * 980);

  fillRect(raster, 0, 0, OG_IMAGE_WIDTH, 10, colors.orange);
  fillRect(raster, 90, 76, 1020, 478, colors.panel);
  strokeRect(raster, 90, 76, 1020, 478, colors.border, 2);
  fillRect(raster, 92, 78, 8, 474, colors.orangeMuted);

  drawText(raster, 116, 112, "BIP-110 MONITOR", 8, colors.text);
  drawText(raster, 116, 182, "SIGNALING STATUS", 5, colors.muted);
  drawText(raster, 116, 238, formatPercent(data.pct), 18, colors.orange);
  drawText(raster, 118, 384, "OF BLOCKS SIGNALING", 5, colors.text);

  drawText(raster, 700, 198, `PERIOD ${data.periodNum}`, 5, colors.text);
  drawText(
    raster,
    700,
    256,
    `${formatInteger(data.signalingCount)} OF ${formatInteger(data.totalBlocks)} BLOCKS`,
    3,
    colors.muted,
  );
  drawText(
    raster,
    700,
    304,
    `INDEXED TIP ${formatInteger(data.tip)}`,
    3,
    colors.muted,
  );
  drawText(
    raster,
    700,
    352,
    `${ACTIVATION_THRESHOLD}% ACTIVATION TARGET`,
    3,
    colors.muted,
  );

  fillRect(raster, 110, 462, 980, 32, colors.panelSoft);
  fillRect(raster, 110, 462, visibleSignalWidth, 32, colors.orange);
  fillRect(raster, thresholdX, 452, 4, 52, colors.text);
  drawText(raster, 110, 516, "0", 3, colors.dim);
  drawText(
    raster,
    thresholdX - 28,
    516,
    `${ACTIVATION_THRESHOLD}%`,
    3,
    colors.muted,
  );
  drawRightText(raster, 1090, 516, "100%", 3, colors.dim);

  fillRect(raster, 110, 568, 980, 10, colors.panelSoft);
  fillRect(raster, 110, 568, Math.round(periodProgress * 980), 10, colors.blue);
  drawText(
    raster,
    110,
    588,
    `PERIOD PROGRESS ${Math.round(periodProgress * 100)}%`,
    3,
    colors.muted,
  );
  drawRightText(raster, 1090, 588, "BIP110.ORG/MONITOR", 3, colors.muted);

  return encodePng(raster);
}
