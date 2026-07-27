let integerFormatter = Intl.NumberFormat.make(~locales=["en-US"])

@genType
let activationThreshold = 55

@genType
let formatInteger = value => integerFormatter->Intl.NumberFormat.formatInt(value)

@genType
let formatPercent = value => `${value->Float.toFixed(~digits=2)}%`

@genType
let monitorDescription = (data: Monitor.monitorData) =>
  [
    `BIP-110 status: ${formatPercent(data.pct)} of blocks signaling`,
    `in difficulty adjustment period ${data.periodNum->formatInteger}`,
    `(${data.signalingCount->formatInteger} of ${data.totalBlocks->formatInteger} blocks).`,
    `${activationThreshold->Int.toString}% needed to activate.`,
  ]->Array.join(" ")
