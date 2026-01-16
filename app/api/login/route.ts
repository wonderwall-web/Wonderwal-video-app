import { NextResponse } from "next/server";
import { getSessionCookieName, signSession } from "@/lib/auth";

export const runtime = "nodejs";

type AnyObj = Record<string, any>;

async function validateToAppsScript(licenseApiUrl: string, license: string, device: string) {
  const url = `${licenseApiUrl}?license=${encodeURIComponent(license)}&device=${encodeURIComponent(device)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  const raw = await res.text();

  let obj: AnyObj | null = null;
  try {
    obj = JSON.parse(raw) as AnyObj;
  } catch {
    obj = null;
  }

  if (!res.ok) return { ok: false, code: "LICENSE_API_DOWN", raw };

  // Apps Script kamu: { ok:true, code:"OK"/"BOUND" } atau { ok:false, error:"..." }
  if (obj && typeof obj.ok === "boolean") {
    if (obj.ok === true) return { ok: true, code: String(obj.code || "OK").toUpperCase(), raw };
    return { ok: false, code: String(obj.error || "LICENSE_INVALID").toUpperCase(), raw };
  }

  return { ok: false, code: "LICENSE_API_BAD_RESPONSE", raw };
}

export async function POST(req: Request) {
  const licenseApiUrl = process.env.LICENSE_API_URL;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!licenseApiUrl) {
    return NextResponse.json({ ok: false, error: "ENV_MISSING", message: "LICENSE_API_URL belum diset." }, { status: 500 });
  }
  if (!sessionSecret) {
    return NextResponse.json({ ok: false, error: "ENV_MISSING", message: "SESSION_SECRET belum diset." }, { status: 500 });
  }

  let body: AnyObj;
  try {
    body = (await req.json()) as AnyObj;
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_JSON" }, { status: 400 });
  }

  const license = String(body?.license || "").trim();
  const device = String(body?.device || "").trim();

  if (!license || !device) {
    return NextResponse.json({ ok: false, error: "MISSING_FIELDS", required: ["license", "device"] }, { status: 400 });
  }

  const v = await validateToAppsScript(licenseApiUrl, license, device);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.code }, { status: 403 });
  }

  const token = signSession({ license, device, iat: Date.now() }, sessionSecret);

  const res = NextResponse.json({ ok: true, code: v.code });
  res.cookies.set(getSessionCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 tahun
  });

  return res;
}
