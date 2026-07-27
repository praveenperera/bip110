import type { UnclassifiedMonitorBlock } from "../lib/monitor.ts";

const UPSTREAM_MONITOR_PAGE = "https://bip110monitor.com";
const MONITOR_REQUEST_TIMEOUT_MS = 5_000;
const MAX_MONITOR_HTML_BYTES = 1_000_000;
const BLOCK_TILE_PATTERN =
  /<div class="block-tile\s+(sig|nosig)(?:\s+[^"]*)?"\s+data-height="(\d+)"\s+data-hash="([0-9a-fA-F]{64})"\s+data-version="0x([0-9a-fA-F]+)"\s+data-time="([^"]+)"\s+data-ntx="(\d+)">/g;
const UPDATED_AT_PATTERN = /Updated:\s*([0-9-]+\s+[0-9:]+\s+UTC)/;

/** Blocks parsed from the public BIP-110 monitor page */
export interface Bip110MonitorBlocks {
  blocks: UnclassifiedMonitorBlock[];
  updatedAt: string;
}

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
  const blocks: UnclassifiedMonitorBlock[] = [];

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

function parseUpdatedAt(html: string): string | null {
  const match = html.match(UPDATED_AT_PATTERN);
  if (!match) return null;

  const timestamp = parseMonitorUtcTime(match[1]);
  if (!timestamp) return null;

  return new Date(timestamp * 1000).toISOString();
}

function parseMonitorUtcTime(value: string): number | null {
  const milliseconds = Date.parse(
    value.trim().replace(" UTC", "Z").replace(" ", "T"),
  );

  if (Number.isNaN(milliseconds)) {
    return null;
  }

  return Math.floor(milliseconds / 1000);
}
