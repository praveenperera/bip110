import { handleMonitorApiRequest, jsonResponse } from "./worker/monitor-data";
import {
  handleMonitorBlocksApiRequest,
  refreshSignalingMinerHistory,
} from "./worker/monitor-blocks";
import { handleMonitorOgImageRequest } from "./worker/monitor-og-image";
import { handleMonitorPageRequest } from "./worker/monitor-page";
import { handleUrsfMonitorPageRequest } from "./worker/ursf-monitor-page";
import { requestMethod, route } from "./worker/WorkerRouter.gen.ts";

export { SignalingMinerHistory } from "./worker/signaling-miner-history";
export { Bip110ViolationStore } from "./worker/bip110-violation-store";

export default {
  async fetch(request, env, ctx) {
    const destination = route(new URL(request.url).pathname);

    if (
      destination !== "assets" &&
      requestMethod(request.method) === "unsupported"
    ) {
      return jsonResponse(
        { error: "Method not allowed" },
        {
          status: 405,
          headers: { allow: "GET, HEAD" },
        },
      );
    }

    switch (destination) {
      case "monitorApi":
        return handleMonitorApiRequest(request, ctx);
      case "monitorBlocksApi":
        return handleMonitorBlocksApiRequest(request, env, ctx);
      case "monitorPage":
        return handleMonitorPageRequest(request, env, ctx);
      case "monitorOgImage":
        return handleMonitorOgImageRequest(request, ctx);
      case "ursfMonitorPage":
        return handleUrsfMonitorPageRequest(request, env, ctx);
      case "assets":
        return env.ASSETS.fetch(request);
    }
  },
  async scheduled(_controller, env) {
    await refreshSignalingMinerHistory(env);
  },
} satisfies ExportedHandler<Env>;
