import { findPhotos, parsePixabay, pixabaySearch, sized } from "../shared/photos";
import type { PhotoSearch, PhotoSuggestion } from "../shared/photos";
import { api } from "./api";

/**
 * Cover photo search, straight from this browser to Pixabay. Pixabay turns away
 * most requests from Cloudflare's shared servers, but answers people's own
 * connections, so the Worker only hands over the key and keeps the picked photo.
 */

let setup: Promise<string | null> | null = null;

/** The Pixabay key, or null when photo search isn't set up. Asked once per visit. */
export function photoKey(): Promise<string | null> {
  setup ??= api.photoSetup().then(
    (s) => s.key,
    (e) => {
      setup = null;
      throw e;
    },
  );
  return setup;
}

// Pixabay asks for answers to be kept, and the same places come up again as people edit.
const answers = new Map<string, Promise<PhotoSuggestion[] | null>>();

function lookup(key: string, params: Record<string, string>): Promise<PhotoSuggestion[] | null> {
  const url = pixabaySearch(key, params);
  let found = answers.get(url);
  if (!found) {
    found = fetch(url, { referrerPolicy: "no-referrer" })
      .then(async (res) => (res.ok ? parsePixabay(await res.json()) : null))
      .catch(() => null)
      .then((photos) => {
        if (!photos) answers.delete(url);
        return photos;
      });
    answers.set(url, found);
  }
  return found;
}

export function searchPhotos(key: string, queries: string[], page = 1): Promise<PhotoSearch> {
  return findPhotos((params) => lookup(key, params), queries, page);
}

async function download(url: string): Promise<Blob | null> {
  const res = await fetch(url, { referrerPolicy: "no-referrer" }).catch(() => null);
  return res?.ok ? res.blob() : null;
}

/**
 * Copies a picked photo to somewhere🎉, since Pixabay's own links only last a day,
 * and gives back the link to save as the cover. The browser fetches the photo and
 * sends it on; if it can't, the Worker has a go itself.
 */
export async function keepPhoto(p: PhotoSuggestion): Promise<string> {
  const file = (await download(sized(p.preview, 960))) ?? (await download(p.preview));
  return (file ? await api.uploadPhoto(p.id, file) : await api.savePhoto(p.id)).url;
}
