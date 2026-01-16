export type ApiKeyItem = {
  key: string;
  cooldownUntil?: number; // epoch ms
};

const LS_KEYS = "ww_api_keys_v1";
const LS_ACTIVE = "ww_api_key_active_idx_v1";

export function loadKeys(): ApiKeyItem[] {
  try {
    const raw = localStorage.getItem(LS_KEYS);
    const arr = raw ? (JSON.parse(raw) as ApiKeyItem[]) : [];
    return Array.isArray(arr) ? arr.slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function saveKeys(keys: ApiKeyItem[]) {
  localStorage.setItem(LS_KEYS, JSON.stringify(keys.slice(0, 5)));
}

export function getActiveIndex(): number {
  const raw = localStorage.getItem(LS_ACTIVE);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? Math.max(0, Math.min(4, n)) : 0;
}

export function setActiveIndex(i: number) {
  localStorage.setItem(LS_ACTIVE, String(Math.max(0, Math.min(4, i))));
}

export function pickReadyKey(keys: ApiKeyItem[]): { apiKey: string | null; index: number } {
  if (!keys.length) return { apiKey: null, index: 0 };
  const now = Date.now();
  const start = getActiveIndex();

  for (let step = 0; step < keys.length; step++) {
    const idx = (start + step) % keys.length;
    const it = keys[idx];
    const cd = it.cooldownUntil || 0;
    if (it.key && cd <= now) {
      setActiveIndex(idx);
      return { apiKey: it.key, index: idx };
    }
  }
  return { apiKey: null, index: start };
}

export function markCooldown(keys: ApiKeyItem[], idx: number, cooldownMs: number) {
  const now = Date.now();
  const next = keys.map((k, i) => (i === idx ? { ...k, cooldownUntil: now + cooldownMs } : k));
  saveKeys(next);
  return next;
}
