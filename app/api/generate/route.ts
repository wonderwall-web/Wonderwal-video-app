import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_MS = 2000;
const lastRequest = new Map<string, number>();

const FALLBACK_LICENSE_API_URL =
  "https://script.google.com/macros/s/AKfycbxVDINwsmkWY7gYCN_WCZjjkvST5A3vhoPO92jF04GR9jafXyqywCVTVHrn82uSp6YWcQ/exec";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { apiKey, license, device, prompt } = body || {};
    if (!apiKey || !license || !device || !prompt) {
      return NextResponse.json({ error: "MISSING_FIELD" }, { status: 400 });
    }

    const licenseApi = process.env.LICENSE_API_URL || process.env.LICENSE_API_URL || FALLBACK_LICENSE_API_URL;

    // rate limit
    const now = Date.now();
    const last = lastRequest.get(license) || 0;
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
    }
    lastRequest.set(license, now);

    // validate license
    const validateUrl =
      licenseApi +
      `?license=${encodeURIComponent(license)}&device=${encodeURIComponent(device)}`;

    const vres = await fetch(validateUrl);
    const vdata = await vres.json().catch(() => null);

    if (!vdata?.ok) {
      return NextResponse.json({ error: vdata?.error || "LICENSE_INVALID" }, { status: 401 });
    }

    // gemini
    const model = "gemini-1.5-flash";
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
      encodeURIComponent(apiKey);

    const gres = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const gjson = await gres.json().catch(() => null);

    if (!gres.ok) {
      return NextResponse.json(
        { error: "GEMINI_ERROR", detail: gjson?.error?.message || JSON.stringify(gjson)?.slice(0, 300) },
        { status: 500 }
      );
    }

    const output = gjson?.candidates?.[0]?.content?.parts?.[0]?.text || "No output";
    return NextResponse.json({ ok: true, output });
  } catch (err: any) {
    return NextResponse.json({ error: "SERVER_ERROR", detail: err?.message || String(err) }, { status: 500 });
  }
}
