export type ApiKeyItem = {
  key: string;
};

const LS_KEYS = "ww_api_keys_v1";

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
