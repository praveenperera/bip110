import { fromHtml, type monitorBlocks } from "./MonitorSourceModel.gen.ts";

const UPSTREAM_MONITOR_PAGE = "https://bip110monitor.com";
const MONITOR_REQUEST_TIMEOUT_MS = 5_000;
const MAX_MONITOR_HTML_BYTES = 1_000_000;

/** Blocks parsed from the public BIP-110 monitor page */
export type Bip110MonitorBlocks = monitorBlocks;

/** Reads and validates the public BIP-110 monitor page */
export async function readBip110MonitorBlocks(): Promise<Bip110MonitorBlocks> {
  const response = await fetch(UPSTREAM_MONITOR_PAGE, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(MONITOR_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`BIP-110 monitor page returned ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (
    contentLength &&
    Number.parseInt(contentLength, 10) > MAX_MONITOR_HTML_BYTES
  ) {
    throw new Error("BIP-110 monitor page exceeded the response size limit");
  }

  const html = await response.text();
  if (html.length > MAX_MONITOR_HTML_BYTES) {
    throw new Error("BIP-110 monitor page exceeded the response size limit");
  }

  const payload = parseBip110MonitorHtml(html);
  if (payload.blocks.length === 0) {
    throw new Error("BIP-110 monitor page returned no blocks");
  }

  return payload;
}

/** Parses block metadata from the public BIP-110 monitor HTML */
export function parseBip110MonitorHtml(html: string): Bip110MonitorBlocks {
  return fromHtml(html, new Date().toISOString());
}
