import { NextResponse } from "next/server";

export const runtime = "nodejs";

function q(req: Request, k: string) {
  try {
    return (new URL(req.url).searchParams.get(k) || "").trim();
  } catch {
    return "";
  }
}

async function readParams(req: Request) {
  let license = q(req, "license");
  let device = q(req, "device");

  if (!license || !device) {
    try {
      const body = await req.json();
      if (!license) license = String(body?.license || "").trim();
      if (!device) device = String(body?.device || "").trim();
    } catch {}
  }

  return { license, device };
}

export async function GET(req: Request) {
  const { license, device } = await readParams(req);
  if (!license || !device) return NextResponse.json({ ok: false, error: "MISSING_PARAMS" }, { status: 400 });

  const base = (process.env.LICENSE_API_URL || "").trim();
  if (!base) return NextResponse.json({ ok: false, error: "ENV_MISSING" }, { status: 500 });

  const url = `${base}?license=${encodeURIComponent(license)}&device=${encodeURIComponent(device)}`;
  const r = await fetch(url);
  const data = await r.json().catch(() => ({} as any));

  const ok = data?.ok === true && (data?.status === "OK" || data?.status === "BOUND" || data?.valid === true);

  const res = NextResponse.json(data, { status: ok ? 200 : 401 });

  if (ok) {
    // session cookie sederhana untuk unlock middleware
    res.cookies.set("ww_session", "ok", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 hari
    });

    // simpan license juga (optional, untuk debug)
    res.cookies.set("ww_license", license, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return res;
}

export async function POST(req: Request) {
  return GET(req);
}
