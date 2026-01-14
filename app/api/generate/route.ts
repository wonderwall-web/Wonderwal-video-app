import { NextResponse } from "next/server";

const RATE_LIMIT = new Map<string, number>(); // license -> timestamp

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { apiKey, license, device, prompt } = body;

    if (!apiKey || !license || !device || !prompt) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELD" }, { status: 400 });
    }

    // Rate limit 1req/2s
    const now = Date.now();
    const last = RATE_LIMIT.get(license) || 0;
    if (now - last < 2000) {
      return NextResponse.json({ ok: false, error: "RATE_LIMIT" }, { status: 429 });
    }
    RATE_LIMIT.set(license, now);

    // Validate license + device ke Apps Script
    const validateUrl = `https://script.google.com/macros/s/XXXXX/exec?license=${license}&device=${device}`;
    const validate = await fetch(validateUrl).then(r => r.json());

    if (!validate.ok) {
      return NextResponse.json({ ok: false, error: validate.error }, { status: 403 });
    }

    // Call Gemini pakai API key user
    const res = await fetch("https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const json = await res.json();

    return NextResponse.json({
      ok: true,
      output: json.candidates?.[0]?.content?.parts?.[0]?.text || ""
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
