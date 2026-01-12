import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const license = (searchParams.get("license") || "").trim();

  if (!license) return NextResponse.json({ ok: true, valid: false });

  const VALIDATE_BASE =
    "https://script.google.com/macros/s/AKfycbyhvIp_KNCqgxe3aOEmWhAIgrasmHKqjfsgc7m5I7cVGn0HoThZ0rm570kqugMoM_0xzg/exec?mode=validate&license=";

  try {
    const r = await fetch(VALIDATE_BASE + encodeURIComponent(license), {
      cache: "no-store",
    });

    const text = await r.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json({ ok: false, valid: false, error: "non_json" });
    }

    return NextResponse.json({
      ok: true,
      valid: !!data.valid,
    });
  } catch {
    return NextResponse.json({ ok: false, valid: false, error: "fetch_failed" });
  }
}
