import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ValidateResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
};

function getLimiterStore(): Map<string, number> {
  const g = globalThis as unknown as { __wwLimiter?: Map<string, number> };
  if (!g.__wwLimiter) g.__wwLimiter = new Map<string, number>();
  return g.__wwLimiter;
}

async function validateLicense(licenseApiUrl: string, license: string, device: string) {
  const url = `${licenseApiUrl}?license=${encodeURIComponent(license)}&device=${encodeURIComponent(device)}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal, cache: "no-store" });
    const text = await res.text();

    let data: ValidateResponse | null = null;
    try {
      data = JSON.parse(text) as ValidateResponse;
    } catch {
      data = null;
    }

    const code = (data?.code || "").toUpperCase();
    const ok = code === "OK" || code === "BOUND";

    return {
      httpOk: res.ok,
      ok,
      code: code || "UNKNOWN",
      raw: text,
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

  let body: any = null;
  try {
    body = await req.json();
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
    return NextResponse.json(
      { ok: false, error: "LICENSE_API_DOWN", code: v.code, raw: v.raw },
      { status: 502 }
    );
  }

  if (!v.ok) {
    return NextResponse.json(
      { ok: false, error: v.code || "LICENSE_INVALID" },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    output: `DUMMY_OK: ${prompt}`,
    license_status: v.code,
  });
}
