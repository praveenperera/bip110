/** Percentage of blocks required for BIP-110 activation */
@genType
let activationThreshold: int

/** Formats an integer with US English grouping */
@genType
let formatInteger: int => string

/** Formats a percentage with exactly two fractional digits */
@genType
let formatPercent: float => string

/** Builds the public summary of one normalized monitor snapshot */
@genType
let monitorDescription: Monitor.monitorData => string
