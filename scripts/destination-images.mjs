// Runs before the build. Notes each guide photo's width and height in content/destination-images.json,
// so guide pages can give the browser the photo's shape before it arrives (no jump as it loads) and
// tell search engines and link previews its size. Photos are WebP (the editor converts uploads); PNG
// and JPEG are read too, and anything else is skipped with a warning.
// It also makes smaller WebP copies of each photo in public/images/sized/<width>/ (not kept in git), so
// phones download a photo the size they show it rather than the full 1280px one. See photoProps in
// src/destinations.ts, which must list the same widths.
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";

const DIR = new URL("../public/images/destinations/", import.meta.url);
const OUT = new URL("../content/destination-images.json", import.meta.url);
const SIZED = new URL("../public/images/sized/", import.meta.url);
export const PHOTO_WIDTHS = [480, 800];

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

  const { default: sharp } = await import("sharp");
  const jobs = [];
  for (const [path, [width]] of Object.entries(sizes)) {
    const file = path.slice("/images/destinations/".length);
    const source = new URL(file, DIR);
    const sourceTime = (await stat(source)).mtimeMs;
    for (const w of PHOTO_WIDTHS.filter((w) => w < width)) {
      const out = new URL(`${w}/${file.replace(/\.\w+$/, ".webp")}`, SIZED);
      const done = await stat(out).then((s) => s.mtimeMs >= sourceTime, () => false);
      if (!done) jobs.push({ source, w, out });
    }
  }
  for (const w of PHOTO_WIDTHS) await mkdir(new URL(`${w}/`, SIZED), { recursive: true });
  // A few at a time: quicker than one by one, without holding every photo in memory at once.
  const made = jobs.length;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let job = jobs.pop(); job; job = jobs.pop()) {
        await sharp(await readFile(job.source)).resize({ width: job.w }).webp({ quality: 72 }).toFile(job.out.pathname);
      }
    }),
  );
  if (made) console.log(`Made ${made} smaller copies of guide photos.`);
  if (unread.length) console.warn(`Photos whose size couldn't be read, shown without one:\n  ${unread.join("\n  ")}`);
  console.log(`Sizes noted for ${Object.keys(sizes).length} guide photos.`);
}
