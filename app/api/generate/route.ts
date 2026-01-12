import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { apiKey, prompt } = await req.json();

  if (!apiKey || !prompt) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await r.json();

    const output =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") || "";

    return NextResponse.json({ ok: true, output });
  } catch {
    return NextResponse.json({ ok: false, error: "gemini_failed" }, { status: 500 });
  }
}
