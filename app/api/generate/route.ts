import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_MS = 2000;

// in-memory rate limit (per license)
const lastRequest = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { apiKey, license, device, prompt } = body || {};

    if (!apiKey || !license || !device || !prompt) {
      return NextResponse.json({ error: "MISSING_FIELD" }, { status: 400 });
    }

    // rate limit
    const now = Date.now();
    const last = lastRequest.get(license) || 0;
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json({ error: "RATE_LIMIT" }, { status: 429 });
    }
    lastRequest.set(license, now);

    // validate license via Apps Script
    const validateUrl =
      process.env.LICENSE_API_URL +
      `?license=${encodeURIComponent(license)}&device=${encodeURIComponent(device)}`;

    const vres = await fetch(validateUrl);
    const vdata = await vres.json();

    if (!vdata.ok) {
      return NextResponse.json({ error: vdata.error || "LICENSE_INVALID" }, { status: 401 });
    }

    // call Gemini (BYOK)
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
      }
    );

    const geminiData = await geminiRes.json();

    const output =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No output";

    return NextResponse.json({ ok: true, output });
  } catch (err: any) {
    return NextResponse.json(
      { error: "SERVER_ERROR", detail: err?.message },
      { status: 500 }
    );
  }
}
