// Runs before the build. Notes each guide photo's width and height in content/destination-images.json,
// so guide pages can give the browser the photo's shape before it arrives (no jump as it loads) and
// tell search engines and link previews its size. Photos are WebP (the editor converts uploads); PNG
// and JPEG are read too, and anything else is skipped with a warning.
import { readdir, readFile, writeFile } from "node:fs/promises";

const DIR = new URL("../public/images/destinations/", import.meta.url);
const OUT = new URL("../content/destination-images.json", import.meta.url);

/** [width, height] from an image file's header, or null if it can't be read. */
export function imageSize(b) {
  if (b.length < 30) return null;
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const chunk = b.toString("ascii", 12, 16);
    if (chunk === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (chunk === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    if (chunk === "VP8L") {
      const bits = b.readUInt32LE(21);
      return [1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff)];
    }
    return null;
  }
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b[0] === 0xff && b[1] === 0xd8) {
    // JPEG: walk the segments to the frame header.
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sizes = {};
  const unread = [];
  for (const file of (await readdir(DIR)).filter((f) => !f.startsWith(".")).sort()) {
    const size = imageSize(await readFile(new URL(file, DIR)));
    if (size) sizes[`/images/destinations/${file}`] = size;
    else unread.push(file);
  }
  await writeFile(OUT, JSON.stringify(sizes) + "\n");
  if (unread.length) console.warn(`Photos whose size couldn't be read, shown without one:\n  ${unread.join("\n  ")}`);
  console.log(`Sizes noted for ${Object.keys(sizes).length} guide photos.`);
}
