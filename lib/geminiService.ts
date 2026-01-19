import { GoogleGenerativeAI } from "@google/generative-ai";

/* =========================================================
   Types
========================================================= */
export interface CallGeminiResult {
  ok: boolean;
  text?: string;
  json?: any;
  error?: string;
  raw?: any;
  usedKeyIndex?: number;
}

export interface PingResult {
  ok: boolean;
  message?: string;
  error?: string;
}

/* =========================================================
   Constants
========================================================= */
const STABLE_MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 3;
const BASE_DELAY = 1200;

/* =========================================================
   Utils
========================================================= */
function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function stripCodeFences(text: string): string {
  return String(text || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

export function extractFirstJsonObject(text: string): any {
  const cleaned = stripCodeFences(text);

  try {
    return JSON.parse(cleaned);
  } catch {}

  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {}
  }

  return null;
}

/* =========================================================
   Core call (single key)
========================================================= */
async function callOnce(apiKey: string, prompt: string): Promise<CallGeminiResult> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: STABLE_MODEL });

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || "";

    if (!text.trim()) {
      return { ok: false, error: "MODEL_EMPTY", raw: result };
    }

    const json = extractFirstJsonObject(text);

    return {
      ok: true,
      text,
      json,
      raw: result,
    };
  } catch (e: any) {
    const msg = String(e?.message || e);

    if (/401|unauth/i.test(msg)) return { ok: false, error: "INVALID_API_KEY", raw: e };
    if (/429|quota|resource_exhausted/i.test(msg)) return { ok: false, error: "RATE_LIMIT", raw: e };
    if (/not found|404/i.test(msg)) return { ok: false, error: "MODEL_NOT_FOUND", raw: e };

    return { ok: false, error: msg || "UNKNOWN_ERROR", raw: e };
  }
}

/* =========================================================
   Public: Rotation + retry
========================================================= */
export async function callGeminiWithRotation(opts: {
  keys: string[];
  prompt: string;
}): Promise<CallGeminiResult> {
  const { keys, prompt } = opts;

  if (!keys || keys.length === 0) return { ok: false, error: "NO_KEYS" };
  if (!prompt) return { ok: false, error: "PROMPT_MISSING" };

  const errors: any[] = [];

  for (let ki = 0; ki < keys.length; ki++) {
    const key = keys[ki]?.trim();
    if (!key) continue;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await callOnce(key, prompt);

      if (res.ok) {
        return { ...res, usedKeyIndex: ki };
      }

      errors.push({ keyIndex: ki, attempt, error: res.error });

      if (res.error === "RATE_LIMIT") {
        await delay(BASE_DELAY * (attempt + 1));
        continue;
      }

      if (res.error === "INVALID_API_KEY") break;
      if (res.error === "MODEL_NOT_FOUND") break;

      await delay(400);
    }

    await delay(600);
  }

  const allRate = errors.length && errors.every(e => e.error === "RATE_LIMIT");

  if (allRate) {
    return {
      ok: false,
      error: "ALL_KEYS_RATE_LIMITED",
      raw: errors,
    };
  }

  return {
    ok: false,
    error: "ALL_ATTEMPTS_FAILED",
    raw: errors,
  };
}

/* =========================================================
   Public: Ping key
========================================================= */
export async function pingGeminiKey(apiKey: string): Promise<PingResult> {
  if (!apiKey) return { ok: false, error: "API_KEY_MISSING" };

  const res = await callOnce(apiKey, "Respond only with: OK");

  if (res.ok) {
    return { ok: true, message: "OK, KEY valid (ping sukses)" };
  }

  return { ok: false, error: res.error || "PING_FAILED" };
}
