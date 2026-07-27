import type {
  Bip110BlockViolationReport,
  UnclassifiedMonitorBlock,
} from "../lib/monitor.ts";
import { readMempoolBlockTransactions } from "./mempool-api.ts";

const MAX_SCRIPT_PUBKEY_BYTES = 34;
const MAX_OP_RETURN_BYTES = 83;
const MAX_PUSH_BYTES = 256;
const MAX_CONTROL_BLOCK_BYTES = 257;
const OP_RETURN = 0x6a;
const OP_IF = 0x63;
const OP_NOTIF = 0x64;

/** BIP-110 rule categories detected in one decoded transaction */
export type Bip110Violation =
  | "large-script-pubkey"
  | "large-pushdata"
  | "undefined-witness"
  | "taproot-annex"
  | "large-control-block"
  | "op-success"
  | "op-if-notif";

interface DecodedTransaction {
  txid: string;
  vin: DecodedInput[];
  vout: DecodedOutput[];
}

interface DecodedInput {
  coinbase: boolean;
  prevoutScript: Uint8Array | null;
  scriptSig: Uint8Array;
  witness: Uint8Array[];
}

interface DecodedOutput {
  scriptPubKey: Uint8Array;
}

interface ScriptOperation {
  data: Uint8Array | null;
  opcode: number;
}

interface WitnessProgram {
  programLength: number;
  version: number;
}

/** Classifies all decoded transactions and counts each violating transaction */
export function countBip110ViolatingTransactions(
  transactions: readonly unknown[],
): number {
  return transactions.reduce<number>(
    (count, transaction) =>
      count + (bip110TransactionViolations(transaction).length > 0 ? 1 : 0),
    0,
  );
}

/** Returns whether Kilombino proves that a violation count has been indexed */
export function isAuthoritativeKilombinoViolationReport(
  report: Bip110BlockViolationReport,
): boolean {
  return report.violations.count > 0;
}

/** Returns the BIP-110 rule categories violated by one decoded transaction */
export function bip110TransactionViolations(value: unknown): Bip110Violation[] {
  const transaction = parseTransaction(value);
  const violations = new Set<Bip110Violation>();

  classifyOutputs(transaction.vout, violations);

  for (const input of transaction.vin) {
    if (input.coinbase) continue;

    classifyPrevout(input, violations);
    classifyScriptSig(input, violations);
    classifyWitness(input, violations);
  }

  return [...violations];
}

/** Reconstructs one block's BIP-110 violation count from public transaction data */
export async function reconstructBip110ViolationReport(
  block: UnclassifiedMonitorBlock,
): Promise<Bip110BlockViolationReport> {
  const { transactions } = await readMempoolBlockTransactions(block);

  return {
    hash: block.hash,
    height: block.height,
    violations: {
      status: "known",
      count: countBip110ViolatingTransactions(transactions),
    },
  };
}

function classifyOutputs(
  outputs: readonly DecodedOutput[],
  violations: Set<Bip110Violation>,
): void {
  for (const { scriptPubKey } of outputs) {
    const limit =
      scriptPubKey[0] === OP_RETURN
        ? MAX_OP_RETURN_BYTES
        : MAX_SCRIPT_PUBKEY_BYTES;

    if (scriptPubKey.length > limit) {
      violations.add("large-script-pubkey");
      return;
    }
  }
}

function classifyPrevout(
  input: DecodedInput,
  violations: Set<Bip110Violation>,
): void {
  const witnessProgram = parseWitnessProgram(input.prevoutScript);
  if (witnessProgram && !isDefinedWitnessProgram(witnessProgram)) {
    violations.add("undefined-witness");
  }
}

function classifyScriptSig(
  input: DecodedInput,
  violations: Set<Bip110Violation>,
): void {
  if (input.scriptSig.length === 0) return;

  const operations = parseScript(input.scriptSig);
  const isP2sh = isP2shScript(input.prevoutScript);
  const redeemScriptIndex =
    isP2sh && operations.at(-1)?.data ? operations.length - 1 : -1;

  for (const [index, operation] of operations.entries()) {
    if (
      index !== redeemScriptIndex &&
      operation.data &&
      operation.data.length > MAX_PUSH_BYTES
    ) {
      violations.add("large-pushdata");
      break;
    }
  }

  if (
    redeemScriptIndex >= 0 &&
    scriptHasLargePush(operations[redeemScriptIndex]?.data ?? null)
  ) {
    violations.add("large-pushdata");
  }
}

function classifyWitness(
  input: DecodedInput,
  violations: Set<Bip110Violation>,
): void {
  if (input.witness.length === 0) return;

  const witnessProgram = parseWitnessProgram(input.prevoutScript);
  if (witnessProgram && !isDefinedWitnessProgram(witnessProgram)) {
    violations.add("undefined-witness");
    return;
  }

  const isTaproot =
    witnessProgram?.version === 1 && witnessProgram.programLength === 32;
  const annexIndex = input.witness.length - 1;
  const hasAnnex =
    isTaproot &&
    input.witness.length > 1 &&
    input.witness[annexIndex]?.[0] === 0x50;
  const witnessEnd = input.witness.length - (hasAnnex ? 1 : 0);
  const isTaprootScriptPath = isTaproot && witnessEnd >= 2;

  if (hasAnnex) {
    violations.add("taproot-annex");
  }

  const exemptItems = new Set<number>();
  const executingScripts: Uint8Array[] = [];

  if (hasAnnex) {
    exemptItems.add(annexIndex);
  }

  if (isTaprootScriptPath) {
    const controlBlockIndex = witnessEnd - 1;
    const tapscriptIndex = controlBlockIndex - 1;
    const controlBlock = input.witness[controlBlockIndex];
    const tapscript = input.witness[tapscriptIndex];

    exemptItems.add(controlBlockIndex);
    exemptItems.add(tapscriptIndex);
    executingScripts.push(tapscript);

    if (controlBlock.length > MAX_CONTROL_BLOCK_BYTES) {
      violations.add("large-control-block");
    }

    if ((controlBlock[0] & 0xfe) !== 0xc0) {
      violations.add("undefined-witness");
    }

    classifyTapscript(tapscript, violations);
  } else if (isTaproot) {
    exemptItems.add(witnessEnd - 1);
  } else if (isWitnessScriptSpend(input.prevoutScript, witnessProgram)) {
    const witnessScriptIndex = witnessEnd - 1;
    exemptItems.add(witnessScriptIndex);
    executingScripts.push(input.witness[witnessScriptIndex]);
  }

  for (const [index, item] of input.witness.entries()) {
    if (!exemptItems.has(index) && item.length > MAX_PUSH_BYTES) {
      violations.add("large-pushdata");
      break;
    }
  }

  if (executingScripts.some(scriptHasLargePush)) {
    violations.add("large-pushdata");
  }
}

function classifyTapscript(
  tapscript: Uint8Array,
  violations: Set<Bip110Violation>,
): void {
  for (const operation of parseScript(tapscript)) {
    if (isOpSuccess(operation.opcode)) {
      violations.add("op-success");
    } else if (operation.opcode === OP_IF || operation.opcode === OP_NOTIF) {
      // match the upstream monitor's structural approximation
      violations.add("op-if-notif");
    }
  }
}

function isWitnessScriptSpend(
  prevoutScript: Uint8Array | null,
  witnessProgram: WitnessProgram | null,
): boolean {
  if (witnessProgram?.version === 0 && witnessProgram.programLength === 32) {
    return true;
  }

  return isP2shScript(prevoutScript);
}

function isP2shScript(script: Uint8Array | null): boolean {
  return (
    script?.length === 23 &&
    script[0] === 0xa9 &&
    script[1] === 0x14 &&
    script[22] === 0x87
  );
}

function isDefinedWitnessProgram(program: WitnessProgram): boolean {
  return (
    (program.version === 0 &&
      (program.programLength === 20 || program.programLength === 32)) ||
    (program.version === 1 &&
      (program.programLength === 2 || program.programLength === 32))
  );
}

function parseWitnessProgram(script: Uint8Array | null): WitnessProgram | null {
  if (!script || script.length < 4 || script.length > 42) return null;

  const versionOpcode = script[0];
  const version =
    versionOpcode === 0
      ? 0
      : versionOpcode >= 0x51 && versionOpcode <= 0x60
        ? versionOpcode - 0x50
        : null;
  const programLength = script[1];

  if (
    version === null ||
    programLength < 2 ||
    programLength > 40 ||
    script.length !== programLength + 2
  ) {
    return null;
  }

  return { programLength, version };
}

function scriptHasLargePush(script: Uint8Array | null): boolean {
  return (
    script?.length !== undefined &&
    parseScript(script).some(
      (operation) =>
        operation.data !== null && operation.data.length > MAX_PUSH_BYTES,
    )
  );
}

function parseScript(script: Uint8Array): ScriptOperation[] {
  const operations: ScriptOperation[] = [];
  let index = 0;

  while (index < script.length) {
    const opcode = script[index];
    index += 1;
    const length = pushLength(script, opcode, index);

    if (!length) {
      operations.push({ data: null, opcode });
      continue;
    }

    index += length.prefixBytes;
    const end = index + length.dataBytes;
    if (end > script.length) break;

    operations.push({
      data: script.slice(index, end),
      opcode,
    });
    index = end;
  }

  return operations;
}

function pushLength(
  script: Uint8Array,
  opcode: number,
  index: number,
): { dataBytes: number; prefixBytes: number } | null {
  if (opcode >= 0x01 && opcode <= 0x4b) {
    return { dataBytes: opcode, prefixBytes: 0 };
  }
  if (opcode === 0x4c && index < script.length) {
    return { dataBytes: script[index], prefixBytes: 1 };
  }
  if (opcode === 0x4d && index + 1 < script.length) {
    return {
      dataBytes: script[index] | (script[index + 1] << 8),
      prefixBytes: 2,
    };
  }
  if (opcode === 0x4e && index + 3 < script.length) {
    const dataBytes =
      script[index] |
      (script[index + 1] << 8) |
      (script[index + 2] << 16) |
      (script[index + 3] << 24);

    return dataBytes >= 0 ? { dataBytes, prefixBytes: 4 } : null;
  }

  return null;
}

function isOpSuccess(opcode: number): boolean {
  return (
    opcode === 80 ||
    opcode === 98 ||
    (opcode >= 126 && opcode <= 129) ||
    (opcode >= 131 && opcode <= 134) ||
    (opcode >= 137 && opcode <= 138) ||
    (opcode >= 141 && opcode <= 142) ||
    (opcode >= 149 && opcode <= 153) ||
    (opcode >= 187 && opcode <= 254)
  );
}

function parseTransaction(value: unknown): DecodedTransaction {
  if (!isRecord(value)) {
    throw new Error("mempool transaction must be an object");
  }

  const txid = stringField(value, "txid");
  if (!/^[0-9a-f]{64}$/i.test(txid)) {
    throw new Error("mempool transaction id must be a transaction hash");
  }
  if (!Array.isArray(value.vin) || !Array.isArray(value.vout)) {
    throw new Error("mempool transaction inputs and outputs must be arrays");
  }

  return {
    txid,
    vin: value.vin.map(parseInput),
    vout: value.vout.map(parseOutput),
  };
}

function parseInput(value: unknown): DecodedInput {
  if (!isRecord(value)) {
    throw new Error("mempool transaction input must be an object");
  }
  if (value.witness !== undefined && !Array.isArray(value.witness)) {
    throw new Error("mempool transaction witness must be an array");
  }

  const coinbase = value.is_coinbase === true;
  const prevout = value.prevout;
  const witness = value.witness ?? [];

  return {
    coinbase,
    prevoutScript:
      coinbase || prevout === null ? null : parsePrevoutScript(prevout),
    scriptSig: hexBytes(stringField(value, "scriptsig"), "input scriptSig"),
    witness: witness.map((item) => hexBytesValue(item, "input witness item")),
  };
}

function parsePrevoutScript(value: unknown): Uint8Array {
  if (!isRecord(value)) {
    throw new Error("mempool transaction prevout must be an object");
  }

  return hexBytes(stringField(value, "scriptpubkey"), "prevout scriptPubKey");
}

function parseOutput(value: unknown): DecodedOutput {
  if (!isRecord(value)) {
    throw new Error("mempool transaction output must be an object");
  }

  return {
    scriptPubKey: hexBytes(
      stringField(value, "scriptpubkey"),
      "output scriptPubKey",
    ),
  };
}

function hexBytesValue(value: unknown, fieldName: string): Uint8Array {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }

  return hexBytes(value, fieldName);
}

function hexBytes(value: string, fieldName: string): Uint8Array {
  if (value.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(value)) {
    throw new Error(`${fieldName} must contain hexadecimal bytes`);
  }

  return Uint8Array.from(
    value.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [],
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringField(
  value: Record<string, unknown>,
  fieldName: string,
): string {
  const fieldValue = value[fieldName];
  if (typeof fieldValue !== "string") {
    throw new Error(`mempool transaction field ${fieldName} must be a string`);
  }

  return fieldValue;
}
