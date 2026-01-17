export type ApiKeySlot = {
  id: string;
  label: string;
  key: string;
  lastUsedAt: number;
  cooldownUntil: number;
  lastError: string;
};

const LS_KEY = "ww_gemini_keys_v1";

const DEFAULT_SLOTS: ApiKeySlot[] = Array.from({ length: 5 }).map((_, i) => ({
  id: `slot_${i + 1}`,
  label: `KEY${i + 1}`,
  key: "",
  lastUsedAt: 0,
  cooldownUntil: 0,
  lastError: "",
}));

export function loadApiKeySlots(): ApiKeySlot[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_SLOTS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SLOTS;

    return DEFAULT_SLOTS.map((d) => {
      const found = parsed.find((x: any) => x?.id === d.id) ?? {};
      return {
        ...d,
        key: typeof found.key === "string" ? found.key : "",
        lastUsedAt: typeof found.lastUsedAt === "number" ? found.lastUsedAt : 0,
        cooldownUntil: typeof found.cooldownUntil === "number" ? found.cooldownUntil : 0,
        lastError: typeof found.lastError === "string" ? found.lastError : "",
      };
    });
  } catch {
    return DEFAULT_SLOTS;
  }
}

export function saveApiKeySlots(slots: ApiKeySlot[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(slots));
}

export function clearApiKeySlots() {
  localStorage.removeItem(LS_KEY);
}

export function updateSlotKey(slotId: string, newKey: string) {
  const slots = loadApiKeySlots();
  const next = slots.map((s) => (s.id === slotId ? { ...s, key: (newKey || "").trim() } : s));
  saveApiKeySlots(next);
  return next;
}

export function markCooldown(slotId: string, msCooldown: number, errShort: string) {
  const now = Date.now();
  const slots = loadApiKeySlots();
  const next = slots.map((s) =>
    s.id === slotId
      ? { ...s, cooldownUntil: now + msCooldown, lastError: errShort || "429", lastUsedAt: now }
      : s
  );
  saveApiKeySlots(next);
  return next;
}

export function markUsed(slotId: string) {
  const now = Date.now();
  const slots = loadApiKeySlots();
  const next = slots.map((s) => (s.id === slotId ? { ...s, lastUsedAt: now, lastError: "" } : s));
  saveApiKeySlots(next);
  return next;
}

export type PickKeyResult =
  | { ok: true; slot: ApiKeySlot; slots: ApiKeySlot[] }
  | { ok: false; reason: "NO_KEYS" | "ALL_COOLDOWN"; nextReadyAt?: number; slots: ApiKeySlot[] };

export function pickReadyKey(): PickKeyResult {
  const now = Date.now();
  const slots = loadApiKeySlots();

  const candidates = slots.filter((s) => s.key.trim().length > 0);
  if (candidates.length === 0) return { ok: false, reason: "NO_KEYS", slots };

  const ready = candidates.filter((s) => s.cooldownUntil <= now);
  if (ready.length === 0) {
    const nextReadyAt = Math.min(...candidates.map((s) => s.cooldownUntil || 0).filter((x) => x > 0));
    return { ok: false, reason: "ALL_COOLDOWN", nextReadyAt, slots };
  }

  ready.sort((a, b) => (a.lastUsedAt || 0) - (b.lastUsedAt || 0));
  return { ok: true, slot: ready[0], slots };
}

export function msToHuman(ms: number) {
  if (ms <= 0) return "0s";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return `${m}m`;
}

// compat (kalau ada kode lama yang masih panggil ini)
export function getFirstApiKey(): string {
  const slots = loadApiKeySlots();
  const first = slots.find((s) => s.key.trim().length > 0);
  return first?.key?.trim() || "";
}
