type knownBlock = {
  hash: string,
  height: int,
  nTx: int,
  signaling: bool,
  time: float,
  version: int,
  violations: Monitor.bip110ViolationStatusWire,
  miner: option<Monitor.signalingMinerDiscoveryWire>,
}

type gridBlock =
  | Known(knownBlock)
  | Placeholder(int)

@genType
type dashboardBlockMode = [#bip110 | #ursf]

@genType
type dashboardBlockPresentation = {
  known: bool,
  signaling: bool,
  clean: bool,
  firstMinerSignal: bool,
  hashLabel: string,
  versionLabel: string,
  timeLabel: string,
  transactionsLabel: string,
  statusLabel: string,
  statusPrefix: string,
  violationCount: Nullable.t<int>,
  violationCountLabel: Nullable.t<string>,
  cleanLabel: Nullable.t<string>,
  firstMinerLabel: Nullable.t<string>,
  title: string,
  hasServerAttribution: bool,
  serverAttribution: Nullable.t<Monitor.blockMiningAttribution>,
}

type linkOptions = {
  className: string,
  clean: bool,
  firstMinerSignal: bool,
  showCleanliness: bool,
  status: string,
}

@send external intToStringWithRadix: (int, int) => string = "toString"

let mempoolBlockUrl = "https://mempool.guide/block"

let fail = () => JsError.throwWithMessage("known monitor grid block is incomplete")

let fromWire = (block: Monitor.monitorGridBlockWire) => {
  switch block.kind {
  | #placeholder => Placeholder(block.height)
  | #known =>
    switch (
      block.hash,
      block.nTx,
      block.signaling,
      block.time,
      block.version,
      block.bip110Violations,
    ) {
    | (Some(hash), Some(nTx), Some(signaling), Some(time), Some(version), Some(violations)) =>
      Known({
        hash,
        height: block.height,
        nTx,
        signaling,
        time,
        version,
        violations,
        miner: block.signalingMiner->Option.flatMap(Nullable.toOption),
      })
    | _ => fail()
    }
  }
}

let gridBlocksFor = (data, blocks) =>
  Monitor.currentPeriodGrid(data, blocks->Nullable.make)
  ->Array.slice(~start=0, ~end=Monitor.monitorGridVisibleBlocks)
  ->Array.map(fromWire)

let isFirstMinerSignal = block => {
  switch block {
  | Known({signaling: true, miner: Some({status: #identified, firstSignal: true})}) => true
  | Known(_) | Placeholder(_) => false
  }
}

let isClean = block => {
  switch block {
  | Known({violations: {status: #known, count: 0}}) => true
  | Known(_) | Placeholder(_) => false
  }
}

let formatBlockMiner = attribution => {
  switch attribution.Monitor.templateMinerName->Nullable.toOption {
  | Some(templateMinerName) => `${attribution.poolName} (${templateMinerName})`
  | None => attribution.poolName
  }
}

@genType
let blockMinerLabel = attribution =>
  switch attribution->Nullable.toOption {
  | Some(attribution) => formatBlockMiner(attribution)
  | None => "Unknown"
  }

let minerName = block => {
  switch block {
  | Known({signaling: true, miner: Some({status: #identified, attribution})}) =>
    Some(formatBlockMiner(attribution))
  | Known(_) | Placeholder(_) => None
  }
}

let formatBlockVersion = value =>
  `0x${value->intToStringWithRadix(16)->String.toUpperCase->String.padStart(8, "0")}`

let formatBlockTime = value =>
  `${Date.fromTime(value *. 1000.0)
    ->Date.toISOString
    ->String.replace("T", " ")
    ->String.slice(~start=0, ~end=16)} UTC`

let dashboardStatus = (block, mode) =>
  switch (mode, block) {
  | (#ursf, _) => "not signaling"
  | (#bip110, Known({signaling: true})) => "SIGNALING BIP-110"
  | (#bip110, Known(_)) => "not signaling"
  | (#bip110, Placeholder(_)) => "signal status unavailable"
  }

@genType
let dashboardBlockPresentation = (wire, mode) => {
  let block = wire->fromWire
  let known = switch block {
  | Known(_) => true
  | Placeholder(_) => false
  }
  let signaling = switch (mode, block) {
  | (#bip110, Known({signaling})) => signaling
  | (#bip110 | #ursf, Known(_) | Placeholder(_)) => false
  }
  let violationCount = switch (mode, block) {
  | (#bip110, Known({violations: {status: #known, count}})) => Some(count)
  | (#bip110 | #ursf, Known(_) | Placeholder(_)) => None
  }
  let (hasServerAttribution, serverAttribution) = switch block {
  | Known({signaling: true, miner: Some({status: #identified, attribution})}) => (
      true,
      Some(attribution),
    )
  | Known({signaling: true, miner: Some({status: #unidentified})}) => (true, None)
  | Known(_) | Placeholder(_) => (false, None)
  }
  let firstMinerSignal = isFirstMinerSignal(block)
  let height = switch block {
  | Known({height}) => height
  | Placeholder(height) => height
  }
  let firstMinerLabel = switch block {
  | Known({signaling: true, miner: Some({status: #identified, firstSignal: true, attribution})}) =>
    Some(`First-ever signal from ${formatBlockMiner(attribution)}`)
  | Known(_) | Placeholder(_) => None
  }
  let statusLabel = dashboardStatus(block, mode)
  let hashLabel = switch block {
  | Known({hash}) => hash
  | Placeholder(_) => "Unavailable"
  }
  let versionLabel = switch block {
  | Known({version}) => formatBlockVersion(version)
  | Placeholder(_) => "Unavailable"
  }
  let timeLabel = switch block {
  | Known({time}) => formatBlockTime(time)
  | Placeholder(_) => "Unavailable"
  }
  let transactionsLabel = switch block {
  | Known({nTx}) => MonitorPresentation.formatInteger(nTx)
  | Placeholder(_) => "Unavailable"
  }
  let lines = [
    `Height ${height->Int.toString}`,
    `Hash ${hashLabel}`,
    `Version ${versionLabel}`,
    `Time ${timeLabel}`,
    `Txs ${transactionsLabel}`,
  ]
  violationCount->Option.forEach(count => {
    lines->Array.push(`Clean ${count === 0 ? "Yes" : "No"}`)->ignore
    lines->Array.push(`Violations ${count->Int.toString}`)->ignore
  })
  lines->Array.push(statusLabel)->ignore
  firstMinerLabel->Option.forEach(label => lines->Array.push(label)->ignore)

  {
    known,
    signaling,
    clean: mode === #bip110 && isClean(block),
    firstMinerSignal: mode === #bip110 && firstMinerSignal,
    hashLabel,
    versionLabel,
    timeLabel,
    transactionsLabel,
    statusLabel,
    statusPrefix: signaling ? "" : "x ",
    violationCount: violationCount->Nullable.fromOption,
    violationCountLabel: violationCount
    ->Option.map(MonitorPresentation.formatInteger)
    ->Nullable.fromOption,
    cleanLabel: violationCount
    ->Option.map(count => count === 0 ? "Yes" : "No")
    ->Nullable.fromOption,
    firstMinerLabel: firstMinerLabel->Nullable.fromOption,
    title: lines->Array.join("\n"),
    hasServerAttribution,
    serverAttribution: serverAttribution->Nullable.fromOption,
  }
}

let escapeAttribute = value =>
  value
  ->String.replaceAll("&", "&amp;")
  ->String.replaceAll("\"", "&quot;")
  ->String.replaceAll("<", "&lt;")
  ->String.replaceAll(">", "&gt;")

let blockHeight = block => {
  switch block {
  | Known(block) => block.height
  | Placeholder(height) => height
  }
}

let blockLinkHtml = (block, options) => {
  let height = blockHeight(block)
  let miner = minerName(block)
  let violationCount = switch (options.showCleanliness, block) {
  | (true, Known({violations: {status: #known, count}})) => Some(count)
  | _ => None
  }
  let title = switch block {
  | Placeholder(_) => `Height ${MonitorPresentation.formatInteger(height)}`
  | Known(block) =>
    let lines = [
      `Height ${MonitorPresentation.formatInteger(block.height)}`,
      `Hash ${block.hash}`,
      `Version ${formatBlockVersion(block.version)}`,
      `Time ${formatBlockTime(block.time)}`,
      `Txs ${MonitorPresentation.formatInteger(block.nTx)}`,
    ]
    miner->Option.forEach(miner => lines->Array.push(`Miner ${miner}`)->ignore)
    violationCount->Option.forEach(count => {
      lines->Array.push(`Clean ${count === 0 ? "Yes" : "No"}`)->ignore
      lines->Array.push(`Violations ${count->Int.toString}`)->ignore
    })
    lines->Array.push(options.status)->ignore
    if options.firstMinerSignal {
      miner->Option.forEach(miner => lines->Array.push(`First-ever signal from ${miner}`)->ignore)
    }
    lines->Array.join("\n")
  }
  let flare = options.firstMinerSignal
    ? "<span aria-hidden=\"true\" class=\"pointer-events-none absolute right-1 top-0.5 text-xs text-primary motion-safe:animate-pulse\">✦</span>"
    : ""

  `<a href="${mempoolBlockUrl}/${height->Int.toString}" target="_blank" rel="noopener noreferrer" class="${options.className}" title="${escapeAttribute(
      title,
    )}">${flare}<span class="relative z-10">${MonitorPresentation.formatInteger(height)}</span></a>`
}

let bip110BlockLinkHtml = block => {
  let firstMinerSignal = isFirstMinerSignal(block)
  let clean = isClean(block)
  let signaling = switch block {
  | Known({signaling}) => signaling
  | Placeholder(_) => false
  }
  let className =
    [
      "relative flex h-12 items-center justify-center overflow-hidden rounded-md border px-2 font-mono text-sm font-semibold tracking-normal transition-colors",
      signaling
        ? "bg-primary/10 text-primary shadow-[inset_0_-3px_0_var(--primary)]"
        : "bg-background/80 text-muted-foreground",
      clean ? "border-primary/30" : "border-border/60",
      firstMinerSignal
        ? "bg-primary/20 ring-2 ring-primary/60 shadow-[inset_0_-3px_0_var(--primary),0_0_18px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
        : "",
    ]
    ->Array.filter(value => value !== "")
    ->Array.join(" ")

  blockLinkHtml(
    block,
    {
      className,
      clean,
      firstMinerSignal,
      showCleanliness: true,
      status: signaling ? "SIGNALING BIP-110" : "not signaling",
    },
  )
}

let ursfBlockLinkHtml = block =>
  blockLinkHtml(
    block,
    {
      className: "ursf-block-cell relative flex h-12 items-center justify-center overflow-hidden rounded-md border border-[var(--ursf-border)] bg-[var(--ursf-block)] px-2 font-mono text-sm font-semibold tracking-normal text-[var(--ursf-block-text)] transition-colors",
      clean: false,
      firstMinerSignal: false,
      showCleanliness: false,
      status: "not signaling",
    },
  )

@genType
let bip110BlockGridHtml = (data, blocks) => {
  let gridBlocks = gridBlocksFor(data, blocks)
  gridBlocks->Array.length === 0
    ? "<p class=\"col-span-full text-sm text-muted-foreground\">No block snapshot available</p>"
    : gridBlocks->Array.map(bip110BlockLinkHtml)->Array.join("")
}

@genType
let ursfBlockGridHtml = (data, blocks) => {
  let gridBlocks = gridBlocksFor(data, blocks)
  gridBlocks->Array.length === 0
    ? "<p class=\"ursf-muted col-span-full text-sm\">No block snapshot available</p>"
    : gridBlocks->Array.map(ursfBlockLinkHtml)->Array.join("")
}

@genType
let bip110FirstSignalLegendHtml = (data, blocks) =>
  gridBlocksFor(data, blocks)->Array.some(isFirstMinerSignal)
    ? [
        "<span class=\"inline-flex items-center gap-2\">",
        "<span class=\"relative size-3 rounded-sm border border-primary bg-primary/20 ring-1 ring-primary/60\" aria-hidden=\"true\">",
        "<span class=\"absolute -right-1 -top-1 text-[0.625rem] leading-none text-primary\">✦</span>",
        "</span>",
        "Miner's first-ever signal",
        "</span>",
      ]->Array.join("")
    : ""
