@genType
type color = (int, int, int)

type raster = {
  width: int,
  height: int,
  pixels: Uint8Array.t,
}

type textEncoder
type blob
type readableStream
type compressionStream
type response

@new external makeTextEncoder: unit => textEncoder = "TextEncoder"
@send external encodeText: (textEncoder, string) => Uint8Array.t = "encode"
@new external makeBlob: array<Uint8Array.t> => blob = "Blob"
@send external blobStream: blob => readableStream = "stream"
@new external makeCompressionStream: string => compressionStream = "CompressionStream"
@send external pipeThrough: (readableStream, compressionStream) => readableStream = "pipeThrough"
@new external makeResponse: readableStream => response = "Response"
@send external responseArrayBuffer: response => promise<ArrayBuffer.t> = "arrayBuffer"
@send external setTypedArray: (Uint8Array.t, Uint8Array.t, int) => unit = "set"
@set_index external setUint8Unsafe: (Uint8Array.t, int, int) => unit = ""
@get_index external getUint32Unsafe: (Uint32Array.t, int) => int = ""
@set_index external setUint32Unsafe: (Uint32Array.t, int, int) => unit = ""

let pngSignature = Uint8Array.fromArray([137, 80, 78, 71, 13, 10, 26, 10])
let textEncoder = makeTextEncoder()

let font = Dict.fromArray([
  (" ", ["000", "000", "000", "000", "000", "000", "000"]),
  ("!", ["1", "1", "1", "1", "1", "0", "1"]),
  ("%", ["10001", "00010", "00100", "01000", "10000", "00000", "10001"]),
  (",", ["0", "0", "0", "0", "0", "1", "1"]),
  (".", ["0", "0", "0", "0", "0", "0", "1"]),
  ("-", ["00000", "00000", "00000", "11111", "00000", "00000", "00000"]),
  ("/", ["00001", "00010", "00100", "01000", "10000", "00000", "00000"]),
  (":", ["0", "1", "0", "0", "0", "1", "0"]),
  ("0", ["01110", "10001", "10011", "10101", "11001", "10001", "01110"]),
  ("1", ["00100", "01100", "00100", "00100", "00100", "00100", "01110"]),
  ("2", ["01110", "10001", "00001", "00010", "00100", "01000", "11111"]),
  ("3", ["11110", "00001", "00001", "01110", "00001", "00001", "11110"]),
  ("4", ["00010", "00110", "01010", "10010", "11111", "00010", "00010"]),
  ("5", ["11111", "10000", "10000", "11110", "00001", "00001", "11110"]),
  ("6", ["01110", "10000", "10000", "11110", "10001", "10001", "01110"]),
  ("7", ["11111", "00001", "00010", "00100", "01000", "01000", "01000"]),
  ("8", ["01110", "10001", "10001", "01110", "10001", "10001", "01110"]),
  ("9", ["01110", "10001", "10001", "01111", "00001", "00001", "01110"]),
  ("A", ["01110", "10001", "10001", "11111", "10001", "10001", "10001"]),
  ("B", ["11110", "10001", "10001", "11110", "10001", "10001", "11110"]),
  ("C", ["01111", "10000", "10000", "10000", "10000", "10000", "01111"]),
  ("D", ["11110", "10001", "10001", "10001", "10001", "10001", "11110"]),
  ("E", ["11111", "10000", "10000", "11110", "10000", "10000", "11111"]),
  ("F", ["11111", "10000", "10000", "11110", "10000", "10000", "10000"]),
  ("G", ["01111", "10000", "10000", "10011", "10001", "10001", "01111"]),
  ("H", ["10001", "10001", "10001", "11111", "10001", "10001", "10001"]),
  ("I", ["11111", "00100", "00100", "00100", "00100", "00100", "11111"]),
  ("J", ["00111", "00010", "00010", "00010", "00010", "10010", "01100"]),
  ("K", ["10001", "10010", "10100", "11000", "10100", "10010", "10001"]),
  ("L", ["10000", "10000", "10000", "10000", "10000", "10000", "11111"]),
  ("M", ["10001", "11011", "10101", "10101", "10001", "10001", "10001"]),
  ("N", ["10001", "11001", "10101", "10011", "10001", "10001", "10001"]),
  ("O", ["01110", "10001", "10001", "10001", "10001", "10001", "01110"]),
  ("P", ["11110", "10001", "10001", "11110", "10000", "10000", "10000"]),
  ("Q", ["01110", "10001", "10001", "10001", "10101", "10010", "01101"]),
  ("R", ["11110", "10001", "10001", "11110", "10100", "10010", "10001"]),
  ("S", ["01111", "10000", "10000", "01110", "00001", "00001", "11110"]),
  ("T", ["11111", "00100", "00100", "00100", "00100", "00100", "00100"]),
  ("U", ["10001", "10001", "10001", "10001", "10001", "10001", "01110"]),
  ("V", ["10001", "10001", "10001", "10001", "10001", "01010", "00100"]),
  ("W", ["10001", "10001", "10001", "10101", "10101", "10101", "01010"]),
  ("X", ["10001", "10001", "01010", "00100", "01010", "10001", "10001"]),
  ("Y", ["10001", "10001", "01010", "00100", "00100", "00100", "00100"]),
  ("Z", ["11111", "00001", "00010", "00100", "01000", "10000", "11111"]),
])

let clampInteger = (value, minimum, maximum) =>
  Math.min(Math.max(Math.floor(value), minimum->Int.toFloat), maximum->Int.toFloat)->Float.toInt

@genType
let fillRect = (raster, x, y, width, height, color) => {
  let minX = clampInteger(x->Int.toFloat, 0, raster.width)
  let minY = clampInteger(y->Int.toFloat, 0, raster.height)
  let maxX = clampInteger((x + width)->Int.toFloat, 0, raster.width)
  let maxY = clampInteger((y + height)->Int.toFloat, 0, raster.height)
  let (red, green, blue) = color

  for row in minY to maxY - 1 {
    let offset = ref((row * raster.width + minX) * 3)

    for _ in minX to maxX - 1 {
      raster.pixels->setUint8Unsafe(offset.contents, red)
      raster.pixels->setUint8Unsafe(offset.contents + 1, green)
      raster.pixels->setUint8Unsafe(offset.contents + 2, blue)
      offset.contents = offset.contents + 3
    }
  }
}

@genType
let createRaster = (width, height, fill) => {
  let raster = {
    width,
    height,
    pixels: Uint8Array.fromLength(width * height * 3),
  }
  fillRect(raster, 0, 0, width, height, fill)
  raster
}

@genType
let strokeRect = (raster, x, y, width, height, color, thickness) => {
  fillRect(raster, x, y, width, thickness, color)
  fillRect(raster, x, y + height - thickness, width, thickness, color)
  fillRect(raster, x, y, thickness, height, color)
  fillRect(raster, x + width - thickness, y, thickness, height, color)
}

let glyphFor = char => font->Dict.get(char)->Option.getOr(font->Dict.get(" ")->Option.getOrThrow)

let drawGlyph = (raster, x, y, glyph, scale, color) =>
  glyph->Array.forEachWithIndex((line, row) =>
    line
    ->String.split("")
    ->Array.forEachWithIndex((bit, column) => {
      if bit === "1" {
        fillRect(raster, x + column * scale, y + row * scale, scale, scale, color)
      }
    })
  )

@genType
let drawText = (raster, x, y, text, scale, color) => {
  let cursor = ref(x)

  text
  ->String.toUpperCase
  ->String.split("")
  ->Array.forEach(char => {
    let glyph = glyphFor(char)
    drawGlyph(raster, cursor.contents, y, glyph, scale, color)
    cursor.contents = cursor.contents + (glyph->Array.getUnsafe(0)->String.length + 1) * scale
  })
}

let measureText = (text, scale) => {
  let chars = text->String.toUpperCase->String.split("")

  chars->Array.reduceWithIndex(0, (width, char, index) => {
    let glyphWidth = glyphFor(char)->Array.getUnsafe(0)->String.length * scale
    index < chars->Array.length - 1 ? width + glyphWidth + scale : width + glyphWidth
  })
}

@genType
let drawRightText = (raster, right, y, text, scale, color) =>
  drawText(raster, right - measureText(text, scale), y, text, scale, color)

let writeUint32 = (bytes, offset, value) => {
  bytes->setUint8Unsafe(offset, value->Int.shiftRightUnsigned(24)->Int.bitwiseAnd(255))
  bytes->setUint8Unsafe(offset + 1, value->Int.shiftRightUnsigned(16)->Int.bitwiseAnd(255))
  bytes->setUint8Unsafe(offset + 2, value->Int.shiftRightUnsigned(8)->Int.bitwiseAnd(255))
  bytes->setUint8Unsafe(offset + 3, value->Int.bitwiseAnd(255))
}

let createCrcTable = () => {
  let table = Uint32Array.fromLength(256)

  for n in 0 to 255 {
    let value = ref(n)

    for _ in 0 to 7 {
      value.contents = if value.contents->Int.bitwiseAnd(1) !== 0 {
        -306674912->Int.bitwiseXor(value.contents->Int.shiftRightUnsigned(1))
      } else {
        value.contents->Int.shiftRightUnsigned(1)
      }
    }

    table->setUint32Unsafe(n, value.contents)
  }

  table
}

let crcTable = createCrcTable()

let updateCrc32 = (crc, data) => {
  let next = ref(crc)

  data->TypedArray.forEach(byte => {
    let index = next.contents->Int.bitwiseXor(byte)->Int.bitwiseAnd(255)
    next.contents =
      crcTable->getUint32Unsafe(index)->Int.bitwiseXor(next.contents->Int.shiftRightUnsigned(8))
  })

  next.contents
}

let crc32 = (typeBytes, data) => -1->updateCrc32(typeBytes)->updateCrc32(data)->Int.bitwiseXor(-1)

let pngChunk = (type_, data) => {
  let typeBytes = textEncoder->encodeText(type_)
  let dataLength = data->TypedArray.length
  let chunk = Uint8Array.fromLength(12 + dataLength)

  writeUint32(chunk, 0, dataLength)
  chunk->setTypedArray(typeBytes, 4)
  chunk->setTypedArray(data, 8)
  writeUint32(chunk, 8 + dataLength, crc32(typeBytes, data))
  chunk
}

let concatBytes = chunks => {
  let length = chunks->Array.reduce(0, (sum, chunk) => sum + chunk->TypedArray.length)
  let output = Uint8Array.fromLength(length)
  let offset = ref(0)

  chunks->Array.forEach(chunk => {
    output->setTypedArray(chunk, offset.contents)
    offset.contents = offset.contents + chunk->TypedArray.length
  })

  output
}

let deflate = async data => {
  let compressed = makeBlob([data])->blobStream->pipeThrough(makeCompressionStream("deflate"))
  let buffer = await compressed->makeResponse->responseArrayBuffer
  Uint8Array.fromBuffer(buffer)
}

@genType
let encodePng = async raster => {
  let ihdr = Uint8Array.fromLength(13)
  writeUint32(ihdr, 0, raster.width)
  writeUint32(ihdr, 4, raster.height)
  ihdr->setUint8Unsafe(8, 8)
  ihdr->setUint8Unsafe(9, 2)

  let rowLength = raster.width * 3 + 1
  let scanlines = Uint8Array.fromLength(rowLength * raster.height)

  for row in 0 to raster.height - 1 {
    let sourceOffset = row * raster.width * 3
    let targetOffset = row * rowLength
    scanlines->setUint8Unsafe(targetOffset, 0)
    scanlines->setTypedArray(
      raster.pixels->TypedArray.subarray(~start=sourceOffset, ~end=sourceOffset + raster.width * 3),
      targetOffset + 1,
    )
  }

  let compressedScanlines = await deflate(scanlines)

  concatBytes([
    pngSignature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressedScanlines),
    pngChunk("IEND", Uint8Array.fromLength(0)),
  ])
}
