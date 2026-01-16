import { NextResponse } from "next/server";

export const runtime = "nodejs";

type AnyObj = Record<string, any>;

function getLimiterStore(): Map<string, number> {
  const g = globalThis as unknown as { __wwLimiter?: Map<string, number> };
  if (!g.__wwLimiter) g.__wwLimiter = new Map<string, number>();
  return g.__wwLimiter;
}

function extractCodeFromText(raw: string): string {
  const t = (raw || "").toUpperCase();

  // Common codes we care about
  const codes = [
    "OK",
    "BOUND",
    "DEVICE_MISMATCH",
    "LICENSE_NOT_FOUND",
    "LICENSE_INACTIVE",
    "LICENSE_INVALID",
    "INVALID_REQUEST",
  ];

  for (const c of codes) {
    if (t.includes(c)) return c;
  }

  return "UNKNOWN";
}

function extractCodeFromJson(obj: AnyObj): string {
  const candidates = [
    obj?.code,
    obj?.status,
    obj?.result,
    obj?.message,
  ]
    .filter(Boolean)
    .map((x) => String(x).toUpperCase());

  for (const s of candidates) {
    const c = extractCodeFromText(s);
    if (c !== "UNKNOWN") return c;
  }

  return "UNKNOWN";
}

async function validateLicense(licenseApiUrl: string, license: string, device: string) {
  const url = `${licenseApiUrl}?license=${encodeURIComponent(license)}&device=${encodeURIComponent(device)}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" });
    const raw = await res.text();

    let code = "UNKNOWN";
    let parsed: AnyObj | null = null;

    try {
      parsed = JSON.parse(raw) as AnyObj;
      code = extractCodeFromJson(parsed);
    } catch {
      code = extractCodeFromText(raw);
    }

    const ok = code === "OK" || code === "BOUND";

    return {
      httpOk: res.ok,
      ok,
      code,
      raw,
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

  // Kalau Apps Script down / non-200
  if (!v.httpOk) {
    return NextResponse.json(
      { ok: false, error: "LICENSE_API_DOWN", code: v.code },
      { status: 502 }
    );
  }

  // Kalau responnya aneh banget (UNKNOWN), kasih error yang jelas
  if (v.code === "UNKNOWN") {
    return NextResponse.json(
      {
        ok: false,
        error: "LICENSE_API_BAD_RESPONSE",
        message: "Apps Script membalas 200 tapi formatnya tidak terbaca (bukan JSON/teks code).",
        raw_preview: v.raw.slice(0, 180),
      },
      { status: 502 }
    );
  }

  // Kalau license ditolak
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.code }, { status: 403 });
  }

  // OK / BOUND
  return NextResponse.json({
    ok: true,
    output: `DUMMY_OK: ${prompt}`,
    license_status: v.code,
  });
}
