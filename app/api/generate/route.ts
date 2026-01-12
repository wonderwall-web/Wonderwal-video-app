import { NextResponse } from "next/server";

function pickText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const t = parts.map((p: any) => p?.text || "").join("").trim();
    if (t) return t;
  }

  const alt1 = data?.candidates?.[0]?.content?.text;
  if (typeof alt1 === "string" && alt1.trim()) return alt1.trim();

  const alt2 = data?.text;
  if (typeof alt2 === "string" && alt2.trim()) return alt2.trim();

  return "";
}

export async function POST(req: Request) {
  const body = await req.json();
  const apiKey = String(body.apiKey || "").trim();
  const prompt = String(body.prompt || "").trim();

  if (!apiKey) return NextResponse.json({ ok: false, error: "missing_api_key" }, { status: 400 });
  if (!prompt) return NextResponse.json({ ok: false, error: "missing_prompt" }, { status: 400 });

  try {
    const r = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
        }),
      }
    );

    const rawText = await r.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch {}

    const output = pickText(data);

    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "gemini_http_error",
          status: r.status,
          details: data?.error || data,
        },
        { status: 500 }
      );
    }

    if (!output) {
      return NextResponse.json({
        ok: false,
        error: "empty_output",
        finishReason: data?.candidates?.[0]?.finishReason || null,
        safetyRatings: data?.candidates?.[0]?.safetyRatings || null,
        note: "Gemini membalas tapi teks kosong. Biasanya karena policy/safety atau format response.",
      });
    }

    return NextResponse.json({ ok: true, output });
  } catch {
    return NextResponse.json({ ok: false, error: "fetch_failed" }, { status: 500 });
  }
}
