// @ts-check
import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

const UPSTREAM_MONITOR_PAGE = "https://bip110monitor.com";
const MONITOR_BLOCKS_API_PATH = "/api/monitor-blocks";
const BLOCK_TILE_PATTERN =
  /<div class="block-tile\s+(sig|nosig)(?:\s+[^"]*)?"\s+data-height="(\d+)"\s+data-hash="([0-9a-fA-F]{64})"\s+data-version="0x([0-9a-fA-F]+)"\s+data-time="([^"]+)"\s+data-ntx="(\d+)">/g;
const UPDATED_AT_PATTERN = /Updated:\s*([0-9-]+\s+[0-9:]+\s+UTC)/;

function parseMonitorUtcTime(value) {
  const milliseconds = Date.parse(
    value.trim().replace(" UTC", "Z").replace(" ", "T"),
  );

  if (Number.isNaN(milliseconds)) {
    return null;
  }

  return Math.floor(milliseconds / 1000);
}

function parseUpdatedAt(html) {
  const match = html.match(UPDATED_AT_PATTERN);
  if (!match) return null;

  const timestamp = parseMonitorUtcTime(match[1]);
  if (!timestamp) return null;

  return new Date(timestamp * 1000).toISOString();
}

function parseMonitorBlocksHtml(html) {
  const blocks = [];

  for (const match of html.matchAll(BLOCK_TILE_PATTERN)) {
    const [, status, height, hash, version, time, nTx] = match;
    const parsedTime = parseMonitorUtcTime(time);

    if (!parsedTime) continue;

    blocks.push({
      hash,
      height: Number.parseInt(height, 10),
      nTx: Number.parseInt(nTx, 10),
      signaling: status === "sig",
      time: parsedTime,
      version: Number.parseInt(version, 16),
    });
  }

  return {
    blocks,
    updatedAt: parseUpdatedAt(html) ?? new Date().toISOString(),
  };
}

function monitorBlocksDevApiPlugin() {
  return {
    name: "bip110-monitor-blocks-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url) {
          next();
          return;
        }

        const url = new URL(req.url, "http://localhost");
        if (url.pathname !== MONITOR_BLOCKS_API_PATH) {
          next();
          return;
        }

        if (req.method !== "GET" && req.method !== "HEAD") {
          res.statusCode = 405;
          res.setHeader("allow", "GET, HEAD");
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }

        try {
          const upstreamResponse = await fetch(UPSTREAM_MONITOR_PAGE, {
            headers: { accept: "text/html" },
          });

          if (!upstreamResponse.ok) {
            throw new Error(`upstream returned ${upstreamResponse.status}`);
          }

          const payload = parseMonitorBlocksHtml(await upstreamResponse.text());
          if (payload.blocks.length === 0) {
            throw new Error("upstream page had no block tiles");
          }

          res.statusCode = 200;
          res.setHeader("cache-control", "no-store");
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(req.method === "HEAD" ? undefined : JSON.stringify(payload));
        } catch {
          res.statusCode = 502;
          res.setHeader("cache-control", "no-store");
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(
            req.method === "HEAD"
              ? undefined
              : JSON.stringify({ error: "Monitor block data unavailable" }),
          );
        }
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: "https://bip110.org",
  trailingSlash: "ignore",
  redirects: {
    "/responses": "/articles#responses",
    "/responses/blockslop": "/articles/blockslop",
    "/responses/op-plenty": "/articles/op-plenty",
  },
  integrations: [react()],

  vite: {
    optimizeDeps: {
      include: ["react-dom/client"],
    },
    plugins: [monitorBlocksDevApiPlugin(), tailwindcss()],
  },
});
