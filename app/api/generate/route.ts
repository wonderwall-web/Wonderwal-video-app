import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AnyObj = Record<string, any>;

function getLimiterStore(): Map<string, number> {
  const g = globalThis as unknown as { __wwLimiter?: Map<string, number> };
  if (!g.__wwLimiter) g.__wwLimiter = new Map<string, number>();
  return g.__wwLimiter;
}

function normalizeResultFromAppsScript(obj: AnyObj, rawText: string) {
  const okBool = typeof obj?.ok === "boolean" ? obj.ok : null;

  // Apps Script kamu: { ok:false, error:"LICENSE_NOT_FOUND" } atau { ok:true, code:"OK"/"BOUND" } (mungkin)
  const codeOrStatus = [obj?.code, obj?.status, obj?.result].find((x) => x !== undefined && x !== null);
  const err = obj?.error;

  const code =
    (okBool === true && (codeOrStatus ? String(codeOrStatus) : "OK")) ||
    (err ? String(err) : (codeOrStatus ? String(codeOrStatus) : "UNKNOWN"));

  const codeUp = code.toUpperCase();

  // Anggap sukses bila ok:true
  const ok = okBool === true || codeUp === "OK" || codeUp === "BOUND";

  return { ok, code: codeUp, raw: rawText };
}

async function validateLicense(licenseApiUrl: string, license: string, device: string) {
  const url = `${licenseApiUrl}?license=${encodeURIComponent(license)}&device=${encodeURIComponent(device)}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" });
    const raw = await res.text();

    // Must be JSON (Apps Script kamu JSON)
    let obj: AnyObj | null = null;
    try {
      obj = JSON.parse(raw) as AnyObj;
    } catch {
      obj = null;
    }

    if (!obj || typeof obj !== "object") {
      return { httpOk: res.ok, ok: false, code: "BAD_RESPONSE", raw };
    }

    const norm = normalizeResultFromAppsScript(obj, raw);

    return {
      httpOk: res.ok,
      ok: norm.ok,
      code: norm.code,
      raw: norm.raw,
    };
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: Request) {
  const licenseApiUrl = process.env.LICENSE_API_URL;
  if (!licenseApiUrl) {
    return NextResponse.json(
      { ok: false, error: "ENV_MISSING", message: "LICENSE_API_URL belum diset di Vercel." },
      { status: 500 }
    );
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

  if (!license || !device || !prompt) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELDS", required: ["license", "device", "prompt"] },
      { status: 400 }
    );
  }

  // Rate limit 1 request / 2 detik per (license+device)
  const store = getLimiterStore();
  const key = `${license}::${device}`;
  const now = Date.now();
  const last = store.get(key) ?? 0;

  if (now - last < 2000) {
    return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
  }
  store.set(key, now);

  const v = await validateLicense(licenseApiUrl, license, device);

  if (!v.httpOk) {
    return NextResponse.json({ ok: false, error: "LICENSE_API_DOWN" }, { status: 502 });
  }

  if (v.code === "BAD_RESPONSE") {
    return NextResponse.json(
      { ok: false, error: "LICENSE_API_BAD_RESPONSE", raw_preview: v.raw.slice(0, 180) },
      { status: 502 }
    );
  }

  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.code }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    output: `DUMMY_OK: ${prompt}`,
    license_status: v.code, // OK atau BOUND (kalau Apps Script ngasih)
  });
}
