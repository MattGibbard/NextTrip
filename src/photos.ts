// Guide photos (and blog posts' own cover photos): their full address, and the smaller copies the browser can pick from. Kept apart from
// destinations.ts so pages that show a photo (blog posts) don't carry every guide's card.
import { SITE } from "../shared/seo";

export function imageUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : SITE + (path.startsWith("/") ? path : `/${path}`);
}

// The smaller copies scripts/destination-images.mjs makes of each guide photo (keep the widths the same).
const PHOTO_WIDTHS = [480, 800];

/**
 * The src and srcSet for a guide photo on the page, so the browser downloads a copy the size it shows.
 * `sizes` is roughly how wide the photo is drawn. Photos from elsewhere, or of unknown size, are used as they are.
 */
export function photoProps(path: string, size: [number, number] | null | undefined, sizes: string) {
  const [, folder, file] = path.match(/^\/?images\/(destinations|blog)\/([^/]+)\.\w+$/) ?? [];
  if (!file || !size) return { src: imageUrl(path) };
  const src = `/images/${folder}/${path.split("/").pop()}`;
  const sub = folder === "blog" ? "blog/" : "";
  const smaller = PHOTO_WIDTHS.filter((w) => w < size[0]).map((w) => `/images/sized/${w}/${sub}${file}.webp ${w}w`);
  return { src, srcSet: [...smaller, `${src} ${size[0]}w`].join(", "), sizes };
}
