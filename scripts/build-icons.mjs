// Rebuilds the app icons from public/favicon.svg (the Noto Emoji party popper, Apache License 2.0):
//   favicon.ico for browsers and search results that ask for it, apple-touch-icon.png for iPhone home screens,
//   and the manifest's icons for Android installs.
// sharp comes with wrangler, so there's nothing extra to install.
// Run with: node scripts/build-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SVG = readFileSync("public/favicon.svg");
const BACKGROUND = "#ffffff";

/** The popper drawn `scale` of the way across a square, on the background if one is given. */
async function icon(size, scale = 1, background) {
  const inner = Math.round(size * scale);
  const popper = await sharp(SVG, { density: Math.max(72, (72 * inner * 2) / 128) })
    .resize(inner, inner)
    .png()
    .toBuffer();
  const offset = Math.round((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: popper, left: offset, top: offset }])
    .png()
    .toBuffer();
}

/** Packs PNGs into one .ico, which every browser reads. */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, i) => {
    const at = 6 + 16 * i;
    header.writeUInt8(size % 256, at);
    header.writeUInt8(size % 256, at + 1);
    header.writeUInt16LE(1, at + 4);
    header.writeUInt16LE(32, at + 6);
    header.writeUInt32LE(png.length, at + 8);
    header.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.png)]);
}

const sizes = [16, 32, 48];
writeFileSync("public/favicon.ico", ico(await Promise.all(sizes.map(async (size) => ({ size, png: await icon(size) })))));
// iOS fills transparency with black and rounds the corners itself, so these get a solid background.
writeFileSync("public/apple-touch-icon.png", await icon(180, 0.72, BACKGROUND));
writeFileSync("public/icon-192.png", await icon(192, 0.72, BACKGROUND));
writeFileSync("public/icon-512.png", await icon(512, 0.72, BACKGROUND));
// Android crops maskable icons to a circle or squircle, so the popper stays inside the middle 80%.
writeFileSync("public/icon-maskable-512.png", await icon(512, 0.56, BACKGROUND));
