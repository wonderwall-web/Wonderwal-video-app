import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const apiKey = String(body?.apiKey || "").trim();
  if (!apiKey) return NextResponse.json({ ok: false, error: "API_KEY_MISSING" }, { status: 400 });

  const prompt =
    "Berikan 1 topik viral Indonesia untuk video pendek. Harus tajam, unik, memancing rasa ingin tahu. Output hanya 1 kalimat, tanpa bullet.";

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 120 },
    }),
  });

  if (r.status === 429) return NextResponse.json({ ok: false, error: "RESOURCE_EXHAUSTED" }, { status: 429 });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return NextResponse.json({ ok: false, error: `GEMINI_HTTP_${r.status}:${t.slice(0, 200)}` }, { status: 400 });
  }

  const j = await r.json().catch(() => ({} as any));
  const topic =
    j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("")?.trim() || "";

  return NextResponse.json({ ok: true, topic });
}
