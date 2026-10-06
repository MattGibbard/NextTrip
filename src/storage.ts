// Small per-browser preferences. Storage can be unavailable (private mode), so never throw.
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`nexttrip.${key}`);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(`nexttrip.${key}`, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function forget(key: string) {
  try {
    localStorage.removeItem(`nexttrip.${key}`);
  } catch {
    // ignore
  }
}
