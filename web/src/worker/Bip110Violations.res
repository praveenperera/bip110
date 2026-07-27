@genType
type violation =
  | @as("large-script-pubkey") LargeScriptPubkey
  | @as("large-pushdata") LargePushdata
  | @as("undefined-witness") UndefinedWitness
  | @as("taproot-annex") TaprootAnnex
  | @as("large-control-block") LargeControlBlock
  | @as("op-success") OpSuccess
  | @as("op-if-notif") OpIfNotif

type decodedInput = {
  coinbase: bool,
  prevoutScript: option<array<int>>,
  scriptSig: array<int>,
  witness: array<array<int>>,
}

type decodedOutput = {scriptPubKey: array<int>}

type decodedTransaction = {
  txid: string,
  vin: array<decodedInput>,
  vout: array<decodedOutput>,
}

type scriptOperation = {
  data: option<array<int>>,
  opcode: int,
}

type witnessProgram = {
  programLength: int,
  version: int,
}

type pushLength = {
  dataBytes: int,
  prefixBytes: int,
}

let maxScriptPubkeyBytes = 34
let maxOpReturnBytes = 83
let maxPushBytes = 256
let maxControlBlockBytes = 257
let opReturn = 0x6a
let opIf = 0x63
let opNotif = 0x64

let fail = message => JsError.throwWithMessage(message)

let byteAt = (bytes, index) => bytes->Array.get(index)->Option.getOr(0)

let addViolation = (violations, violation) => {
  if !Array.some(violations, existing => existing === violation) {
    violations->Array.push(violation)->ignore
  }
}

let requiredField = (object, fieldName, message) =>
  switch object->Dict.get(fieldName) {
  | Some(value) => value
  | None => fail(message)
  }

let stringField = (object, fieldName) =>
  switch object->requiredField(
    fieldName,
    `mempool transaction field ${fieldName} must be a string`,
  ) {
  | JSON.String(value) => value
  | _ => fail(`mempool transaction field ${fieldName} must be a string`)
  }

let hexBytes = (value, fieldName) => {
  if mod(value->String.length, 2) !== 0 || !RegExp.test(/^[0-9a-f]*$/i, value) {
    fail(`${fieldName} must contain hexadecimal bytes`)
  }

  Array.fromInitializer(~length=value->String.length / 2, index =>
    value
    ->String.slice(~start=index * 2, ~end=index * 2 + 2)
    ->Int.fromString(~radix=16)
    ->Option.getOr(0)
  )
}

let hexBytesValue = (value, fieldName) =>
  switch value {
  | JSON.String(value) => hexBytes(value, fieldName)
  | _ => fail(`${fieldName} must be a string`)
  }

let parsePrevoutScript = value =>
  switch value {
  | JSON.Object(object) => object->stringField("scriptpubkey")->hexBytes("prevout scriptPubKey")
  | _ => fail("mempool transaction prevout must be an object")
  }

let parseInput = value =>
  switch value {
  | JSON.Object(object) =>
    let witness = switch object->Dict.get("witness") {
    | None => []
    | Some(JSON.Array(items)) => items->Array.map(item => hexBytesValue(item, "input witness item"))
    | Some(_) => fail("mempool transaction witness must be an array")
    }
    let coinbase = switch object->Dict.get("is_coinbase") {
    | Some(JSON.Boolean(true)) => true
    | _ => false
    }
    let prevoutScript = if coinbase {
      None
    } else {
      switch object->Dict.get("prevout") {
      | Some(JSON.Null) => None
      | Some(prevout) => Some(parsePrevoutScript(prevout))
      | None => Some(parsePrevoutScript(JSON.Null))
      }
    }

    {
      coinbase,
      prevoutScript,
      scriptSig: object->stringField("scriptsig")->hexBytes("input scriptSig"),
      witness,
    }
  | _ => fail("mempool transaction input must be an object")
  }

let parseOutput = value =>
  switch value {
  | JSON.Object(object) => {
      scriptPubKey: object->stringField("scriptpubkey")->hexBytes("output scriptPubKey"),
    }
  | _ => fail("mempool transaction output must be an object")
  }

let parseTransaction = value =>
  switch value {
  | JSON.Object(object) =>
    let txid = object->stringField("txid")
    if !RegExp.test(/^[0-9a-f]{64}$/i, txid) {
      fail("mempool transaction id must be a transaction hash")
    }

    switch (object->Dict.get("vin"), object->Dict.get("vout")) {
    | (Some(JSON.Array(vin)), Some(JSON.Array(vout))) => {
        txid,
        vin: vin->Array.map(parseInput),
        vout: vout->Array.map(parseOutput),
      }
    | _ => fail("mempool transaction inputs and outputs must be arrays")
    }
  | _ => fail("mempool transaction must be an object")
  }

let pushLength = (script, opcode, index) => {
  if opcode >= 0x01 && opcode <= 0x4b {
    Some({dataBytes: opcode, prefixBytes: 0})
  } else if opcode === 0x4c && index < script->Array.length {
    Some({dataBytes: byteAt(script, index), prefixBytes: 1})
  } else if opcode === 0x4d && index + 1 < script->Array.length {
    Some({
      dataBytes: Int.bitwiseOr(byteAt(script, index), Int.shiftLeft(byteAt(script, index + 1), 8)),
      prefixBytes: 2,
    })
  } else if opcode === 0x4e && index + 3 < script->Array.length {
    let dataBytes = Int.bitwiseOr(
      Int.bitwiseOr(byteAt(script, index), Int.shiftLeft(byteAt(script, index + 1), 8)),
      Int.bitwiseOr(
        Int.shiftLeft(byteAt(script, index + 2), 16),
        Int.shiftLeft(byteAt(script, index + 3), 24),
      ),
    )

    dataBytes >= 0 ? Some({dataBytes, prefixBytes: 4}) : None
  } else {
    None
  }
}

let parseScript = script => {
  let operations: array<scriptOperation> = []
  let index = ref(0)

  while index.contents < script->Array.length {
    let opcode = byteAt(script, index.contents)
    index.contents = index.contents + 1

    switch pushLength(script, opcode, index.contents) {
    | None => operations->Array.push({data: None, opcode})->ignore
    | Some(length) =>
      index.contents = index.contents + length.prefixBytes
      let endIndex = index.contents + length.dataBytes

      if endIndex <= script->Array.length {
        operations
        ->Array.push({
          data: Some(script->Array.slice(~start=index.contents, ~end=endIndex)),
          opcode,
        })
        ->ignore
        index.contents = endIndex
      } else {
        index.contents = script->Array.length
      }
    }
  }

  operations
}

let parseWitnessProgram = script =>
  switch script {
  | None => None
  | Some(script) if script->Array.length < 4 || script->Array.length > 42 => None
  | Some(script) =>
    let versionOpcode = byteAt(script, 0)
    let version = if versionOpcode === 0 {
      Some(0)
    } else if versionOpcode >= 0x51 && versionOpcode <= 0x60 {
      Some(versionOpcode - 0x50)
    } else {
      None
    }
    let programLength = byteAt(script, 1)

    switch version {
    | Some(version)
      if programLength >= 2 && programLength <= 40 && script->Array.length === programLength + 2 =>
      Some({programLength, version})
    | _ => None
    }
  }

let isDefinedWitnessProgram = program =>
  (program.version === 0 && (program.programLength === 20 || program.programLength === 32)) ||
    (program.version === 1 && (program.programLength === 2 || program.programLength === 32))

let isP2shScript = script =>
  switch script {
  | Some(script) =>
    script->Array.length === 23 &&
    byteAt(script, 0) === 0xa9 &&
    byteAt(script, 1) === 0x14 &&
    byteAt(script, 22) === 0x87
  | None => false
  }

let scriptHasLargePush = script =>
  switch script {
  | Some(script) =>
    script
    ->parseScript
    ->Array.some(operation =>
      switch operation.data {
      | Some(data) => data->Array.length > maxPushBytes
      | None => false
      }
    )
  | None => false
  }

let isWitnessScriptSpend = (prevoutScript, witnessProgram) =>
  switch witnessProgram {
  | Some({version: 0, programLength: 32}) => true
  | _ => isP2shScript(prevoutScript)
  }

let isOpSuccess = opcode =>
  opcode === 80 ||
  opcode === 98 ||
  opcode >= 126 && opcode <= 129 ||
  opcode >= 131 && opcode <= 134 ||
  opcode >= 137 && opcode <= 138 ||
  opcode >= 141 && opcode <= 142 ||
  opcode >= 149 && opcode <= 153 ||
  (opcode >= 187 && opcode <= 254)

let classifyOutputs = (outputs, violations) => {
  let oversized = outputs->Array.some(({scriptPubKey}) => {
    let limit = byteAt(scriptPubKey, 0) === opReturn ? maxOpReturnBytes : maxScriptPubkeyBytes

    scriptPubKey->Array.length > limit
  })

  if oversized {
    violations->addViolation(LargeScriptPubkey)
  }
}

let classifyPrevout = (input, violations) => {
  switch parseWitnessProgram(input.prevoutScript) {
  | Some(program) if !isDefinedWitnessProgram(program) => violations->addViolation(UndefinedWitness)
  | _ => ()
  }
}

let classifyScriptSig = (input, violations) => {
  if input.scriptSig->Array.length > 0 {
    let operations = parseScript(input.scriptSig)
    let lastIndex = operations->Array.length - 1
    let redeemScriptIndex = if isP2shScript(input.prevoutScript) {
      switch operations->Array.get(lastIndex) {
      | Some({data: Some(_)}) => lastIndex
      | _ => -1
      }
    } else {
      -1
    }
    let hasLargeNonRedeemPush = operations->Array.someWithIndex((operation, index) =>
      index !== redeemScriptIndex &&
        switch operation.data {
        | Some(data) => data->Array.length > maxPushBytes
        | None => false
        }
    )

    if hasLargeNonRedeemPush {
      violations->addViolation(LargePushdata)
    }

    if redeemScriptIndex >= 0 {
      let redeemScript =
        operations
        ->Array.get(redeemScriptIndex)
        ->Option.flatMap(operation => operation.data)

      if scriptHasLargePush(redeemScript) {
        violations->addViolation(LargePushdata)
      }
    }
  }
}

let classifyTapscript = (tapscript, violations) =>
  tapscript
  ->parseScript
  ->Array.forEach(operation => {
    if isOpSuccess(operation.opcode) {
      violations->addViolation(OpSuccess)
    } else if operation.opcode === opIf || operation.opcode === opNotif {
      // match the upstream monitor's structural approximation
      violations->addViolation(OpIfNotif)
    }
  })

let classifyWitness = (input, violations) => {
  if input.witness->Array.length > 0 {
    let witnessProgram = parseWitnessProgram(input.prevoutScript)

    switch witnessProgram {
    | Some(program) if !isDefinedWitnessProgram(program) =>
      violations->addViolation(UndefinedWitness)
    | _ =>
      let isTaproot = switch witnessProgram {
      | Some({version: 1, programLength: 32}) => true
      | _ => false
      }
      let annexIndex = input.witness->Array.length - 1
      let hasAnnex =
        isTaproot &&
        input.witness->Array.length > 1 &&
        byteAt(input.witness->Array.get(annexIndex)->Option.getOr([]), 0) === 0x50
      let witnessEnd = input.witness->Array.length - (hasAnnex ? 1 : 0)
      let isTaprootScriptPath = isTaproot && witnessEnd >= 2
      let exemptItems: array<int> = []
      let executingScripts: array<array<int>> = []

      if hasAnnex {
        violations->addViolation(TaprootAnnex)
        exemptItems->Array.push(annexIndex)->ignore
      }

      if isTaprootScriptPath {
        let controlBlockIndex = witnessEnd - 1
        let tapscriptIndex = controlBlockIndex - 1
        let controlBlock = input.witness->Array.get(controlBlockIndex)->Option.getOr([])
        let tapscript = input.witness->Array.get(tapscriptIndex)->Option.getOr([])

        exemptItems->Array.push(controlBlockIndex)->ignore
        exemptItems->Array.push(tapscriptIndex)->ignore
        executingScripts->Array.push(tapscript)->ignore

        if controlBlock->Array.length > maxControlBlockBytes {
          violations->addViolation(LargeControlBlock)
        }
        if Int.bitwiseAnd(byteAt(controlBlock, 0), 0xfe) !== 0xc0 {
          violations->addViolation(UndefinedWitness)
        }

        classifyTapscript(tapscript, violations)
      } else if isTaproot {
        exemptItems->Array.push(witnessEnd - 1)->ignore
      } else if isWitnessScriptSpend(input.prevoutScript, witnessProgram) {
        let witnessScriptIndex = witnessEnd - 1
        exemptItems->Array.push(witnessScriptIndex)->ignore
        executingScripts
        ->Array.push(input.witness->Array.get(witnessScriptIndex)->Option.getOr([]))
        ->ignore
      }

      let hasLargeWitnessItem =
        input.witness->Array.someWithIndex((item, index) =>
          !Array.some(exemptItems, exemptIndex => exemptIndex === index) &&
          item->Array.length > maxPushBytes
        )

      if (
        hasLargeWitnessItem ||
        executingScripts->Array.some(script => scriptHasLargePush(Some(script)))
      ) {
        violations->addViolation(LargePushdata)
      }
    }
  }
}

@genType
let bip110TransactionViolations = value => {
  let transaction = parseTransaction(value)
  let violations: array<violation> = []

  classifyOutputs(transaction.vout, violations)

  transaction.vin->Array.forEach(input => {
    if !input.coinbase {
      classifyPrevout(input, violations)
      classifyScriptSig(input, violations)
      classifyWitness(input, violations)
    }
  })

  violations
}

@genType
let countBip110ViolatingTransactions = transactions =>
  transactions->Array.reduce(0, (count, transaction) =>
    count + (bip110TransactionViolations(transaction)->Array.length > 0 ? 1 : 0)
  )

@genType
let isAuthoritativeKilombinoViolationReport = (report: Monitor.bip110BlockViolationReport) =>
  report.violations.count > 0
