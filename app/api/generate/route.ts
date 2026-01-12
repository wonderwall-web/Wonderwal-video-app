import { NextResponse } from "next/server";

const VERSION = "gen-v2-debug-20260112";

function pickText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    const t = parts.map((p: any) => (p?.text ? String(p.text) : "")).join("").trim();
    if (t) return t;
  }
  const alt = data?.candidates?.[0]?.content?.text;
  if (typeof alt === "string" && alt.trim()) return alt.trim();
  return "";
}

export async function GET() {
  return NextResponse.json({ ok: true, version: VERSION, method: "GET" });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const apiKey = String(body.apiKey || "").trim();
  const prompt = String(body.prompt || "").trim();

  if (!apiKey) return NextResponse.json({ ok: false, error: "missing_api_key", version: VERSION }, { status: 400 });
  if (!prompt) return NextResponse.json({ ok: false, error: "missing_prompt", version: VERSION }, { status: 400 });

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

    if (!r.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "gemini_http_error",
          status: r.status,
          version: VERSION,
          details: data?.error || data,
        },
        { status: 500 }
      );
    }

    const output = pickText(data);

    if (!output) {
      return NextResponse.json({
        ok: false,
        error: "empty_output",
        version: VERSION,
        finishReason: data?.candidates?.[0]?.finishReason || null,
        safetyRatings: data?.candidates?.[0]?.safetyRatings || null,
      });
    }

    return NextResponse.json({ ok: true, output, version: VERSION });
  } catch {
    return NextResponse.json({ ok: false, error: "fetch_failed", version: VERSION }, { status: 500 });
  }
}
