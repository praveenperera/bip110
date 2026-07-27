// @ts-check
import { execFile } from "node:child_process";

import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { fromHtml as monitorBlocksFromHtml } from "./src/worker/MonitorSourceModel.res.js";
import {
  monitorBlocksApiPath,
  requestMethod,
} from "./src/worker/WorkerRouter.res.js";

const UPSTREAM_MONITOR_PAGE = "https://bip110monitor.com";

function compileReScript() {
  return new Promise((resolve, reject) => {
    execFile(
      "npm",
      ["run", "res:build"],
      { cwd: process.cwd() },
      (error, stdout, stderr) => {
        if (!error) {
          resolve();
          return;
        }

        reject(new Error(stderr || stdout || "ReScript compilation failed"));
      },
    );
  });
}

function rescriptDevPlugin() {
  let previousCompile = Promise.resolve();

  return {
    name: "bip110-rescript-dev",
    configureServer(server) {
      server.watcher.add(["src/**/*.res", "src/**/*.resi"]);
    },
    async handleHotUpdate({ file, server }) {
      if (!file.endsWith(".res") && !file.endsWith(".resi")) {
        return;
      }

      const compile = previousCompile.catch(() => {}).then(compileReScript);
      previousCompile = compile;
      await compile;
      server.ws.send({ type: "full-reload" });

      return [];
    },
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
        if (url.pathname !== monitorBlocksApiPath) {
          next();
          return;
        }

        if (requestMethod(req.method ?? "") === "unsupported") {
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

          const payload = monitorBlocksFromHtml(
            await upstreamResponse.text(),
            new Date().toISOString(),
          );
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
    plugins: [rescriptDevPlugin(), monitorBlocksDevApiPlugin(), tailwindcss()],
  },
});
