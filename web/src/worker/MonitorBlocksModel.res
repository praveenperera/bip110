@genType
type signalingClassification = {
  hash: string,
  discovery: Monitor.signalingMinerDiscoveryWire,
}

@genType
type signalingPlan = {
  periodStart: int,
  blocks: array<SignalingMinerHistoryModel.signalingBlockReference>,
}

let unavailableViolations: Monitor.bip110ViolationStatusWire = {status: #unavailable}
let unavailableMiner: Monitor.signalingMinerDiscoveryWire = {status: #unavailable}

@genType
let mergeBlocks = (
  monitorBlocks: array<Monitor.unclassifiedMonitorBlock>,
  fallbackBlocks: array<Monitor.unclassifiedMonitorBlock>,
) => {
  let byHeight =
    monitorBlocks
    ->Array.map(block => (block.height, block))
    ->Map.fromArray

  fallbackBlocks->Array.forEach(block => byHeight->Map.set(block.height, block))
  byHeight
  ->Map.values
  ->Iterator.toArray
  ->Array.toSorted((left, right) => Int.compare(right.height, left.height))
}

@genType
let classifyBlocks = (
  blocks: array<Monitor.unclassifiedMonitorBlock>,
  classifications: array<signalingClassification>,
  violationReports: array<Monitor.bip110BlockViolationReport>,
  updatedAt,
) => {
  let classificationsByHash =
    classifications
    ->Array.map(classification => (classification.hash, classification.discovery))
    ->Map.fromArray
  let violationsByHash: Map.t<string, Monitor.bip110ViolationStatusWire> =
    violationReports
    ->Array.map(report => (
      report.hash,
      (
        {
          status: #known,
          count: report.violations.count,
        }: Monitor.bip110ViolationStatusWire
      ),
    ))
    ->Map.fromArray
  let classifiedBlocks: array<Monitor.monitorBlockWire> = blocks->Array.map(block => {
    let bip110Violations =
      violationsByHash->Map.get(block.hash)->Option.getOr(unavailableViolations)

    (
      {
        hash: block.hash,
        height: block.height,
        nTx: block.nTx,
        signaling: block.signaling,
        time: block.time,
        version: block.version,
        bip110Violations,
        signalingMiner: block.signaling
          ? classificationsByHash
            ->Map.get(block.hash)
            ->Option.getOr(unavailableMiner)
            ->Nullable.make
          : Nullable.null,
      }: Monitor.monitorBlockWire
    )
  })

  (
    {
      blocks: classifiedBlocks,
      updatedAt,
    }: Monitor.monitorBlocksPayload
  )
}

@genType
let cacheTtl = (blocks: array<Monitor.monitorBlockWire>, expectedTip, ~normalTtl, ~catchUpTtl) => {
  switch expectedTip->Nullable.toOption {
  | None => normalTtl
  | Some(expectedTip) =>
    switch blocks->Array.get(0) {
    | Some(block) if block.height === expectedTip => normalTtl
    | Some(_) | None => catchUpTtl
    }
  }
}

@genType
let signalingPlan = (blocks: array<Monitor.unclassifiedMonitorBlock>) => {
  switch blocks->Array.get(0) {
  | None => Nullable.null
  | Some(highestBlock) =>
    let signalingBlocks: array<SignalingMinerHistoryModel.signalingBlockReference> =
      blocks
      ->Array.filter(block => block.signaling)
      ->Array.map((block): SignalingMinerHistoryModel.signalingBlockReference => {
        hash: block.hash,
        height: block.height,
      })

    signalingBlocks->Array.length === 0
      ? Nullable.null
      : Nullable.make({
          periodStart: highestBlock.height / Monitor.periodSize * Monitor.periodSize,
          blocks: signalingBlocks,
        })
  }
}
