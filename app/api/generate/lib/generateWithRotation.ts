import { loadKeys, pickReadyKey, markCooldown } from "../../../lib/apikeyStore";

export async function generateWithRotation(payload: {
  license: string;
  device: string;
  prompt: string;
}) {
  let keys = loadKeys();
  const picked = pickReadyKey(keys);
  if (!picked.apiKey) throw new Error("NO_API_KEY_SET");

  // 1x coba
  let res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, apiKey: picked.apiKey }),
  });

  // kalau key kena limit → cooldown 60s → rotasi → retry 1x
  if (res.status === 429) {
    const data = await res.json().catch(() => null);
    if (data?.error === "API_KEY_LIMIT") {
      keys = markCooldown(keys, picked.index, 60_000);
      const next = pickReadyKey(keys);
      if (!next.apiKey) throw new Error("ALL_KEYS_ON_COOLDOWN");

      // tunggu 2 detik biar lolos rate limit server
      await new Promise((r) => setTimeout(r, 2000));

      res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, apiKey: next.apiKey }),
      });
    }
  }

  const out = await res.json().catch(() => null);
  if (!res.ok || !out?.ok) throw new Error(out?.error || "GENERATE_FAILED");
  return out.output as string;
}
