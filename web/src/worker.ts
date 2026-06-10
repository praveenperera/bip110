import {
  MONITOR_API_PATH,
  handleMonitorApiRequest,
} from "./worker/monitor-data";
import {
  MONITOR_OG_IMAGE_PATH,
  handleMonitorOgImageRequest,
} from "./worker/monitor-og-image";
import {
  MONITOR_PAGE_PATHS,
  handleMonitorPageRequest,
} from "./worker/monitor-page";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === MONITOR_API_PATH) {
      return handleMonitorApiRequest(request, ctx);
    }

    if (MONITOR_PAGE_PATHS.has(url.pathname)) {
      return handleMonitorPageRequest(request, env, ctx);
    }

    if (url.pathname === MONITOR_OG_IMAGE_PATH) {
      return handleMonitorOgImageRequest(request, ctx);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
