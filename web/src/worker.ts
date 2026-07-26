import {
  MONITOR_API_PATH,
  handleMonitorApiRequest,
} from "./worker/monitor-data";
import {
  MONITOR_BLOCKS_API_PATH,
  handleMonitorBlocksApiRequest,
  refreshSignalingMinerHistory,
} from "./worker/monitor-blocks";
import {
  MONITOR_OG_IMAGE_PATH,
  handleMonitorOgImageRequest,
} from "./worker/monitor-og-image";
import {
  MONITOR_PAGE_PATHS,
  handleMonitorPageRequest,
} from "./worker/monitor-page";
import {
  URSF_MONITOR_PAGE_PATHS,
  handleUrsfMonitorPageRequest,
} from "./worker/ursf-monitor-page";

export { SignalingMinerHistory } from "./worker/signaling-miner-history";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === MONITOR_API_PATH) {
      return handleMonitorApiRequest(request, ctx);
    }

    if (url.pathname === MONITOR_BLOCKS_API_PATH) {
      return handleMonitorBlocksApiRequest(request, env, ctx);
    }

    if (MONITOR_PAGE_PATHS.has(url.pathname)) {
      return handleMonitorPageRequest(request, env, ctx);
    }

    if (url.pathname === MONITOR_OG_IMAGE_PATH) {
      return handleMonitorOgImageRequest(request, ctx);
    }

    if (URSF_MONITOR_PAGE_PATHS.has(url.pathname)) {
      return handleUrsfMonitorPageRequest(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
  async scheduled(_controller, env) {
    await refreshSignalingMinerHistory(env);
  },
} satisfies ExportedHandler<Env>;
