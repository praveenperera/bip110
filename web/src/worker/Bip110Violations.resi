/** BIP-110 rule categories detected in one decoded transaction */
@genType
type violation =
  | @as("large-script-pubkey") LargeScriptPubkey
  | @as("large-pushdata") LargePushdata
  | @as("undefined-witness") UndefinedWitness
  | @as("taproot-annex") TaprootAnnex
  | @as("large-control-block") LargeControlBlock
  | @as("op-success") OpSuccess
  | @as("op-if-notif") OpIfNotif

/** Returns the BIP-110 rule categories violated by one decoded transaction */
@genType
let bip110TransactionViolations: JSON.t => array<violation>

/** Classifies transactions and counts each violating transaction once */
@genType
let countBip110ViolatingTransactions: array<JSON.t> => int

/** Returns whether Kilombino proves that a violation count has been indexed */
@genType
let isAuthoritativeKilombinoViolationReport: Monitor.bip110BlockViolationReport => bool
