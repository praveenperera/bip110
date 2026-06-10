const UPSTREAM_MONITOR_API = "https://bip110monitor.com/api";
const MONITOR_API_PATH = "/api/monitor";
const CACHE_TTL_SECONDS = 60;

function jsonResponse(body, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function monitorCacheKey(request) {
  const url = new URL(request.url);
  url.pathname = MONITOR_API_PATH;
  url.search = "";

  return new Request(url.toString(), { method: "GET" });
}

async function handleMonitorRequest(request, ctx) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse(
      { error: "Method not allowed" },
      {
        status: 405,
        headers: { allow: "GET, HEAD" },
      },
    );
  }

  const cache = caches.default;
  const cacheKey = monitorCacheKey(request);
  const cached = await cache.match(cacheKey);

  if (cached) {
    const headers = new Headers(cached.headers);
    headers.set("x-bip110-cache", "HIT");

    return new Response(request.method === "HEAD" ? null : cached.body, {
      headers,
      status: cached.status,
      statusText: cached.statusText,
    });
  }

  const upstreamResponse = await fetch(UPSTREAM_MONITOR_API, {
    headers: { accept: "application/json" },
  });

  if (!upstreamResponse.ok) {
    return jsonResponse(
      { error: "Monitor API unavailable" },
      {
        status: upstreamResponse.status,
        headers: {
          "cache-control": "no-store",
          "x-bip110-cache": "BYPASS",
        },
      },
    );
  }

  const body = await upstreamResponse.text();
  const headers = new Headers({
    "access-control-allow-origin": "*",
    "cache-control": `public, max-age=${CACHE_TTL_SECONDS}`,
    "content-type":
      upstreamResponse.headers.get("content-type") ??
      "application/json; charset=utf-8",
    "x-bip110-cache": "MISS",
  });

  const response = new Response(body, {
    headers,
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
  });

  ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));

  return request.method === "HEAD" ? new Response(null, response) : response;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === MONITOR_API_PATH) {
      return handleMonitorRequest(request, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
