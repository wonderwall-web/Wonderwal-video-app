export type GeminiOk<T> = { ok: true; data: T };
export type GeminiErr = { ok: false; error: string; raw?: any };
export type GeminiResult<T> = GeminiOk<T> | GeminiErr;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

type GenerateTextInput = {
  apiKey: string;
  model?: string; // default: gemini-2.5-flash
  prompt: string;
  system?: string;
};

export async function geminiGenerateText(
  input: GenerateTextInput
): Promise<GeminiResult<{ text: string; raw: any }>> {
  try {
    const apiKey = (input.apiKey || "").trim();
    if (!apiKey) return { ok: false, error: "API_KEY_MISSING" };

    const model = (input.model || "gemini-2.5-flash").trim();
    const url =
      API_BASE +
      "/models/" +
      encodeURIComponent(model) +
      ":generateContent?key=" +
      encodeURIComponent(apiKey);

    const body: any = {
      contents: [{ role: "user", parts: [{ text: input.prompt || "" }] }],
    };

    const sys = (input.system || "").trim();
    if (sys) body.systemInstruction = { role: "system", parts: [{ text: sys }] };

    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const raw = await r.json().catch(() => ({}));

    if (!r.ok) {
      return {
        ok: false,
        error: "GEMINI_HTTP_" + r.status + ":" + JSON.stringify(raw),
        raw,
      };
    }

    const parts = raw?.candidates?.[0]?.content?.parts || [];
    const text = Array.isArray(parts)
      ? parts.map((p: any) => p?.text).filter(Boolean).join("")
      : "";

    return { ok: true, data: { text, raw } };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

type PingInput = {
  apiKey: string;
  model?: string; // default: gemini-2.5-flash
};

export async function geminiPing(
  input: PingInput
): Promise<GeminiResult<{ raw: any }>> {
  const apiKey = (input.apiKey || "").trim();
  if (!apiKey) return { ok: false, error: "API_KEY_MISSING" };

  const model = (input.model || "gemini-2.5-flash").trim();
  const res = await geminiGenerateText({
    apiKey,
    model,
    prompt: "ping",
    system: "Reply with exactly: OK",
  });

  if (!res.ok) return res;
  return { ok: true, data: { raw: res.data.raw } };
}
