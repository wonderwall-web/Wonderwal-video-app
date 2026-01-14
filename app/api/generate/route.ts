import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_MS = 2000;
const lastRequest = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { apiKey, license, device, prompt } = body || {};

    if (!apiKey || !license || !device || !prompt) {
      return NextResponse.json({ error: "MISSING_FIELD" }, { status: 400 });
    }

    const LICENSE_API_URL = process.env.LICENSE_API_URL;
    if (!LICENSE_API_URL) {
      return NextResponse.json(
        { error: "LICENSE_API_URL_MISSING" },
        { status: 500 }
      );
    }

    // rate limit per license
    const now = Date.now();
    const last = lastRequest.get(license) || 0;
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
    }
    lastRequest.set(license, now);

    // validate via Apps Script
    const validateUrl =
      LICENSE_API_URL +
      `?license=${encodeURIComponent(license)}&device=${encodeURIComponent(
        device
      )}`;

    let vres: Response;
    try {
      vres = await fetch(validateUrl, { method: "GET" });
    } catch (e: any) {
      return NextResponse.json(
        { error: "LICENSE_VALIDATE_FETCH_FAILED", detail: e?.message },
        { status: 500 }
      );
    }

    let vdata: any = null;
    try {
      vdata = await vres.json();
    } catch {
      const txt = await vres.text().catch(() => "");
      return NextResponse.json(
        { error: "LICENSE_VALIDATE_BAD_JSON", detail: txt.slice(0, 300) },
        { status: 500 }
      );
    }

    if (!vdata?.ok) {
      return NextResponse.json(
        { error: vdata?.error || "LICENSE_INVALID" },
        { status: 401 }
      );
    }

    // call Gemini (BYOK)
    const model = "gemini-1.5-flash";
    const geminiUrl =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=` +
      encodeURIComponent(apiKey);

    const gres = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const gjson = await gres.json().catch(() => null);

    if (!gres.ok) {
      return NextResponse.json(
        {
          error: "GEMINI_ERROR",
          detail: gjson?.error?.message || JSON.stringify(gjson)?.slice(0, 300),
        },
        { status: 500 }
      );
    }

    const output =
      gjson?.candidates?.[0]?.content?.parts?.[0]?.text || "No output";

    return NextResponse.json({ ok: true, output });
  } catch (err: any) {
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
