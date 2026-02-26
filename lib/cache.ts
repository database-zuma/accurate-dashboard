const store = new Map<string, { data: unknown; exp: number }>();
const TTL = 300_000;

export function getCached<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function setCache(key: string, data: unknown, ttl = TTL): void {
  store.set(key, { data, exp: Date.now() + ttl });
}
