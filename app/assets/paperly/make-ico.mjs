// Packs PNGs into a Windows .ico. Vista and later read PNG-compressed
// entries directly, so each size goes in whole -- no BMP re-encoding, and no
// dependency beyond node.
import { readFileSync, writeFileSync } from "node:fs";

const out = process.argv[2];
const files = process.argv.slice(3);
if (!out || !files.length) {
	console.error("usage: make-ico.mjs <out.ico> <png...>");
	process.exit(1);
}

const pngs = files.map((f) => {
	const buf = readFileSync(f);
	// PNG: 8-byte signature, then IHDR whose width and height are big-endian
	// 32-bit at offsets 16 and 20.
	const width = buf.readUInt32BE(16);
	const height = buf.readUInt32BE(20);
	return { buf, width, height };
});

const HEADER = 6, ENTRY = 16;
const dir = Buffer.alloc(HEADER + ENTRY * pngs.length);
dir.writeUInt16LE(0, 0);             // reserved
dir.writeUInt16LE(1, 2);             // 1 = icon
dir.writeUInt16LE(pngs.length, 4);

let offset = dir.length;
for (const [i, png] of pngs.entries()) {
	const at = HEADER + ENTRY * i;
	// 256 is stored as 0: the field is one byte.
	dir.writeUInt8(png.width >= 256 ? 0 : png.width, at);
	dir.writeUInt8(png.height >= 256 ? 0 : png.height, at + 1);
	dir.writeUInt8(0, at + 2);       // palette size
	dir.writeUInt8(0, at + 3);       // reserved
	dir.writeUInt16LE(1, at + 4);    // colour planes
	dir.writeUInt16LE(32, at + 6);   // bits per pixel
	dir.writeUInt32LE(png.buf.length, at + 8);
	dir.writeUInt32LE(offset, at + 12);
	offset += png.buf.length;
}

writeFileSync(out, Buffer.concat([dir, ...pngs.map((p) => p.buf)]));
console.log(`${out}: ${pngs.length} sizes, ${offset} bytes`);
