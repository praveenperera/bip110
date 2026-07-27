/** Availability of detailed monitor-block data */
type dataStatus = [#loading | #live | #unavailable]

/** Detailed-block request state */
type state

/** Detailed-block controller returned by the React hook */
type controller = {
  state: state,
  refresh: unit => unit,
}

/** Loads, polls, and refreshes detailed blocks for the expected tip */
let useMonitorBlocks: Nullable.t<int> => controller

/** Returns loaded blocks or null before the first success */
let blocks: state => Nullable.t<array<Monitor.monitorBlockWire>>

/** Returns current detailed-block availability */
let status: state => dataStatus
