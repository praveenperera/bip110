import { signalingMinerId, type BlockMiningAttribution } from "../lib/monitor";

/** First known signal for one identified miner before live history storage */
export interface HistoricalFirstSignal {
  attribution: BlockMiningAttribution;
  height: number;
}

// periods 465–475 are immutable and seed first-ever discovery before live tracking
const HISTORICAL_FIRST_SIGNALS: readonly HistoricalFirstSignal[] = [
  oceanSignal(938_903, "Barefoot Mining"),
  oceanSignal(942_721, "234 Alberta"),
  oceanSignal(950_356, "SoV"),
  oceanSignal(951_929, "Roughnecks"),
  oceanSignal(951_972, "Peer to Peer Money"),
  oceanSignal(952_680, "BIP110"),
  oceanSignal(956_740, "Sazmining"),
  oceanSignal(957_110, "Crestmont Fabrics Ltd"),
  oceanSignal(957_482, "Datum Miner"),
  oceanSignal(958_831, "SpammersGFY"),
  oceanSignal(959_143, "888"),
  oceanSignal(959_199, "Moonwalk"),
  oceanSignal(959_449, "PyBLOCKDatum"),
  oceanSignal(959_562, "Just For Krypto"),
  oceanSignal(959_614, "JAMIN"),
];

/** Returns the immutable first signals that predate persistent live tracking */
export function historicalFirstSignals(): readonly HistoricalFirstSignal[] {
  return HISTORICAL_FIRST_SIGNALS;
}

/** Returns the stable miner identity for a historical first signal */
export function historicalSignalingMinerId(
  signal: HistoricalFirstSignal,
): string {
  const minerId = signalingMinerId(signal.attribution);
  if (!minerId) {
    throw new Error(
      `historical signal at height ${signal.height} has no miner identity`,
    );
  }

  return minerId;
}

function oceanSignal(
  height: number,
  templateMinerName: string,
): HistoricalFirstSignal {
  return {
    attribution: {
      poolName: "OCEAN",
      poolSlug: "ocean",
      templateMinerName,
    },
    height,
  };
}
