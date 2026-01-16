import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AnyObj = Record<string, any>;

function getLimiterStore(): Map<string, number> {
  const g = globalThis as unknown as { __wwLimiter?: Map<string, number> };
  if (!g.__wwLimiter) g.__wwLimiter = new Map<string, number>();
  return g.__wwLimiter;
}

async function validateLicense(licenseApiUrl: string, license: string, device: string) {
  const url = `${licenseApiUrl}?license=${encodeURIComponent(license)}&device=${encodeURIComponent(device)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const raw = await res.text();

  let obj: AnyObj | null = null;
  try {
    obj = JSON.parse(raw) as AnyObj;
  } catch {
    obj = null;
  }

  if (!res.ok) return { ok: false, code: "LICENSE_API_DOWN" };

  if (obj && typeof obj.ok === "boolean") {
    if (obj.ok === true) return { ok: true, code: String(obj.code || "OK").toUpperCase() };
    return { ok: false, code: String(obj.error || "LICENSE_INVALID").toUpperCase() };
  }

  return { ok: false, code: "LICENSE_API_BAD_RESPONSE" };
}

async function callGemini(apiKey: string, prompt: string) {
  const model = "gemini-1.5-flash"; // aman sebagai default; bisa kamu ganti nanti
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const text = await res.text();

  if (res.status === 429 || text.toUpperCase().includes("RESOURCE_EXHAUSTED")) {
    return { ok: false, limit: true, raw: text };
  }

  if (!res.ok) {
    return { ok: false, limit: false, raw: text };
  }

  let obj: AnyObj | null = null;
  try {
    obj = JSON.parse(text) as AnyObj;
  } catch {
    obj = null;
  }

  const out =
    obj?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ||
    "";

  return { ok: true, output: out || "(empty)", raw: text };
}

export async function POST(req: Request) {
  const licenseApiUrl = process.env.LICENSE_API_URL;
  if (!licenseApiUrl) {
    return NextResponse.json({ ok: false, error: "ENV_MISSING", message: "LICENSE_API_URL belum diset." }, { status: 500 });
  }

  let body: AnyObj;
  try {
    body = (await req.json()) as AnyObj;
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_JSON" }, { status: 400 });
  }

  const license = String(body?.license || "").trim();
  const device = String(body?.device || "").trim();
  const prompt = String(body?.prompt || "").trim();
  const apiKey = String(body?.apiKey || "").trim();

  if (!license || !device || !prompt) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS", required: ["license", "device", "prompt"] }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "API_KEY_MISSING" }, { status: 400 });
  }

  // Rate limit 1 req / 2 detik per (license+device)
  const store = getLimiterStore();
  const key = `${license}::${device}`;
  const now = Date.now();
  const last = store.get(key) ?? 0;
  if (now - last < 2000) {
    return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
  }
  store.set(key, now);

  const v = await validateLicense(licenseApiUrl, license, device);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.code }, { status: 403 });
  }

  const g = await callGemini(apiKey, prompt);
  if (!g.ok) {
    if (g.limit) {
      return NextResponse.json({ ok: false, error: "API_KEY_LIMIT" }, { status: 429 });
    }
    return NextResponse.json({ ok: false, error: "GEMINI_ERROR" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, output: g.output });
}
