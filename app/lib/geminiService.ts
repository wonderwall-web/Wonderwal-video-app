import { markCooldown, markUsed, pickReadyKey, type PickKeyResult } from "./apikeyStore";

type GeminiCallOk = { ok: true; text: string };
type GeminiCallFail = { ok: false; error: string; status?: number };
type GeminiCallResult = GeminiCallOk | GeminiCallFail;

const COOLDOWN_MS = 60_000;

function isPickFail(p: PickKeyResult): p is Extract<PickKeyResult, { ok: false }> {
  return p.ok === false;
}

function isGeminiFail(r: GeminiCallResult): r is GeminiCallFail {
  return r.ok === false;
}

async function callGeminiWithKey(apiKey: string, prompt: string): Promise<GeminiCallResult> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 429) return { ok: false, error: "RESOURCE_EXHAUSTED", status: 429 };

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return { ok: false, error: `GEMINI_HTTP_${res.status}:${t.slice(0, 200)}`, status: res.status };
  }

  const data = await res.json().catch(() => ({} as any));
  const text =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("") || "";

  return { ok: true, text };
}

export async function generateWithRotation(
  prompt: string
): Promise<{ ok: true; text: string; usedKey: string } | { ok: false; error: string }> {
  const tried: string[] = [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const pick = pickReadyKey();

    if (isPickFail(pick)) {
      if (pick.reason === "NO_KEYS") return { ok: false, error: "NO_KEYS: isi minimal 1 API key di /settings" };
      const wait = Math.max(0, (pick.nextReadyAt || 0) - Date.now());
      return { ok: false, error: `ALL_COOLDOWN: tunggu ${Math.ceil(wait / 1000)}s` };
    }

    const slot = pick.slot;
    tried.push(slot.label);

    const result = await callGeminiWithKey(slot.key, prompt);

    if (!isGeminiFail(result)) {
      markUsed(slot.id);
      return { ok: true, text: result.text, usedKey: slot.label };
    }

    if (result.status === 429 || result.error.includes("RESOURCE_EXHAUSTED")) {
      markCooldown(slot.id, COOLDOWN_MS, "429");
      continue;
    }

    markCooldown(slot.id, 10_000, result.error.slice(0, 40));
  }

  return { ok: false, error: `FAILED_AFTER_ROTATION: tried=${tried.join(",")}` };
}
