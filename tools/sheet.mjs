// Outil de vérification : range des buffers RGBA dans une planche, agrandie, et écrit un PNG.
// node tools/preview.mjs <groupe> -> tools/out/<groupe>.png
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

// sprites : [{w,h,data}] ; bg : [r,g,b]
export function sheet(name, sprites, { scale = 4, bg = [88, 104, 70], pad = 4, cols = 8 } = {}) {
  const rows = [];
  for (let i = 0; i < sprites.length; i += cols) rows.push(sprites.slice(i, i + cols));
  const W = Math.max(...rows.map((r) => r.reduce((a, s) => a + s.w + pad, pad)));
  const H = rows.reduce((a, r) => a + Math.max(...r.map((s) => s.h)) + pad, pad);
  const out = new Uint8ClampedArray(W * scale * H * scale * 4);
  for (let i = 0; i < out.length; i += 4) { out[i] = bg[0]; out[i + 1] = bg[1]; out[i + 2] = bg[2]; out[i + 3] = 255; }
  let y = pad;
  for (const r of rows) {
    let x = pad;
    for (const s of r) {
      for (let sy = 0; sy < s.h; sy++) for (let sx = 0; sx < s.w; sx++) {
        const o = (sy * s.w + sx) * 4, a = s.data[o + 3] / 255;
        if (!a) continue;
        for (let k = 0; k < scale * scale; k++) {
          const px = (x + sx) * scale + (k % scale), py = (y + sy) * scale + ((k / scale) | 0);
          const d = (py * W * scale + px) * 4;
          for (let c = 0; c < 3; c++) out[d + c] = out[d + c] * (1 - a) + s.data[o + c] * a;
        }
      }
      x += s.w + pad;
    }
    y += Math.max(...r.map((s) => s.h)) + pad;
  }
  mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
  const file = new URL(`./out/${name}.png`, import.meta.url);
  writeFileSync(file, encodePNG(W * scale, H * scale, out));
  console.log('écrit', file.pathname, W * scale, 'x', H * scale);
}
