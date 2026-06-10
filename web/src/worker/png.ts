export type Color = readonly [number, number, number];

interface Raster {
  width: number;
  height: number;
  pixels: Uint8Array;
}

const pngSignature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const textEncoder = new TextEncoder();
const crcTable = createCrcTable();

const font: Record<string, readonly string[]> = {
  " ": ["000", "000", "000", "000", "000", "000", "000"],
  "!": ["1", "1", "1", "1", "1", "0", "1"],
  "%": ["10001", "00010", "00100", "01000", "10000", "00000", "10001"],
  ",": ["0", "0", "0", "0", "0", "1", "1"],
  ".": ["0", "0", "0", "0", "0", "0", "1"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "/": ["00001", "00010", "00100", "01000", "10000", "00000", "00000"],
  ":": ["0", "1", "0", "0", "0", "1", "0"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
};

export function createRaster(
  width: number,
  height: number,
  fill: Color,
): Raster {
  const raster = {
    width,
    height,
    pixels: new Uint8Array(width * height * 3),
  };

  fillRect(raster, 0, 0, width, height, fill);

  return raster;
}

export function fillRect(
  raster: Raster,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Color,
): void {
  const minX = clampInteger(x, 0, raster.width);
  const minY = clampInteger(y, 0, raster.height);
  const maxX = clampInteger(x + width, 0, raster.width);
  const maxY = clampInteger(y + height, 0, raster.height);

  for (let row = minY; row < maxY; row += 1) {
    let offset = (row * raster.width + minX) * 3;

    for (let col = minX; col < maxX; col += 1) {
      raster.pixels[offset] = color[0];
      raster.pixels[offset + 1] = color[1];
      raster.pixels[offset + 2] = color[2];
      offset += 3;
    }
  }
}

export function strokeRect(
  raster: Raster,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Color,
  thickness = 1,
): void {
  fillRect(raster, x, y, width, thickness, color);
  fillRect(raster, x, y + height - thickness, width, thickness, color);
  fillRect(raster, x, y, thickness, height, color);
  fillRect(raster, x + width - thickness, y, thickness, height, color);
}

export function drawText(
  raster: Raster,
  x: number,
  y: number,
  text: string,
  scale: number,
  color: Color,
  letterSpacing = 1,
): void {
  let cursor = x;

  for (const char of text.toUpperCase()) {
    const glyph = glyphFor(char);

    drawGlyph(raster, cursor, y, glyph, scale, color);
    cursor += (glyph[0].length + letterSpacing) * scale;
  }
}

export function drawRightText(
  raster: Raster,
  right: number,
  y: number,
  text: string,
  scale: number,
  color: Color,
  letterSpacing = 1,
): void {
  drawText(
    raster,
    right - measureText(text, scale, letterSpacing),
    y,
    text,
    scale,
    color,
    letterSpacing,
  );
}

export function measureText(
  text: string,
  scale: number,
  letterSpacing = 1,
): number {
  let width = 0;
  const chars = [...text.toUpperCase()];

  chars.forEach((char, index) => {
    width += glyphFor(char)[0].length * scale;

    if (index < chars.length - 1) {
      width += letterSpacing * scale;
    }
  });

  return width;
}

export async function encodePng(raster: Raster): Promise<Uint8Array> {
  const ihdr = new Uint8Array(13);
  writeUint32(ihdr, 0, raster.width);
  writeUint32(ihdr, 4, raster.height);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowLength = raster.width * 3 + 1;
  const scanlines = new Uint8Array(rowLength * raster.height);

  for (let row = 0; row < raster.height; row += 1) {
    const sourceOffset = row * raster.width * 3;
    const targetOffset = row * rowLength;
    scanlines[targetOffset] = 0;
    scanlines.set(
      raster.pixels.subarray(sourceOffset, sourceOffset + raster.width * 3),
      targetOffset + 1,
    );
  }

  const compressedScanlines = await deflate(scanlines);

  return concatBytes([
    pngSignature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressedScanlines),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const compressed = new Blob([data])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  const buffer = await new Response(compressed).arrayBuffer();

  return new Uint8Array(buffer);
}

function drawGlyph(
  raster: Raster,
  x: number,
  y: number,
  glyph: readonly string[],
  scale: number,
  color: Color,
): void {
  glyph.forEach((line, row) => {
    [...line].forEach((bit, col) => {
      if (bit === "1") {
        fillRect(raster, x + col * scale, y + row * scale, scale, scale, color);
      }
    });
  });
}

function glyphFor(char: string): readonly string[] {
  return font[char] ?? font[" "];
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = textEncoder.encode(type);
  const chunk = new Uint8Array(12 + data.length);

  writeUint32(chunk, 0, data.length);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  writeUint32(chunk, 8 + data.length, crc32(typeBytes, data));

  return chunk;
}

function crc32(typeBytes: Uint8Array, data: Uint8Array): number {
  let crc = 0xffffffff;
  crc = updateCrc32(crc, typeBytes);
  crc = updateCrc32(crc, data);

  return (crc ^ 0xffffffff) >>> 0;
}

function updateCrc32(crc: number, data: Uint8Array): number {
  let next = crc;

  for (const byte of data) {
    next = crcTable[(next ^ byte) & 0xff] ^ (next >>> 8);
  }

  return next;
}

function createCrcTable(): Uint32Array {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n += 1) {
    let c = n;

    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    table[n] = c >>> 0;
  }

  return table;
}

function concatBytes(chunks: readonly Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  chunks.forEach((chunk) => {
    output.set(chunk, offset);
    offset += chunk.length;
  });

  return output;
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max);
}
