const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const NOSTR_JSON = "web/public/.well-known/nostr.json";

function bech32Decode(bech: string): { hrp: string; data: number[] } {
  bech = bech.toLowerCase();
  const pos = bech.lastIndexOf("1");
  if (pos < 1 || pos + 7 > bech.length)
    throw new Error("invalid bech32 string");

  const hrp = bech.slice(0, pos);
  const data = [...bech.slice(pos + 1)].map((c) => {
    const idx = CHARSET.indexOf(c);
    if (idx === -1) throw new Error(`invalid character: ${c}`);
    return idx;
  });

  // strip checksum (last 6 characters)
  return { hrp, data: data.slice(0, -6) };
}

function convertBits(
  data: number[],
  fromBits: number,
  toBits: number,
): number[] {
  let acc = 0;
  let bits = 0;
  const maxv = (1 << toBits) - 1;
  const result: number[] = [];

  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    throw new Error("invalid bech32 padding");
  }

  return result;
}

function npubToHex(npub: string): string {
  const { hrp, data } = bech32Decode(npub);
  if (hrp !== "npub") throw new Error(`expected npub prefix, got: ${hrp}`);

  const decoded = convertBits(data, 5, 8);
  if (decoded.length !== 32)
    throw new Error(`invalid npub: expected 32 bytes, got ${decoded.length}`);

  return decoded.map((b) => b.toString(16).padStart(2, "0")).join("");
}

const [username, npub] = Bun.argv.slice(2);
if (!username || !npub) {
  console.error("usage: bun run scripts/nostr-add.ts <username> <npub>");
  process.exit(1);
}

const hex = npubToHex(npub);
const file = Bun.file(NOSTR_JSON);
const json = await file.json();
json.names[username] = hex;
await Bun.write(file, JSON.stringify(json, null, 2) + "\n");

console.log(`added ${username} -> ${hex}`);
