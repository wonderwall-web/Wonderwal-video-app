import { NextResponse } from "next/server";

export const runtime = "nodejs";

function pickJson(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : "";
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const apiKey = String(body?.apiKey || "").trim();
  const topic = String(body?.topic || "").trim();
  const format = String(body?.format || "9:16").trim();
  const style = String(body?.style || "Clean Dark").trim();

  if (!apiKey) return NextResponse.json({ ok: false, error: "API_KEY_MISSING" }, { status: 400 });
  if (!topic) return NextResponse.json({ ok: false, error: "TOPIC_MISSING" }, { status: 400 });

  const sys =
    `Buat skrip video pendek dari topik. Output HARUS JSON valid (tanpa markdown).` +
    ` Format=${format}. Style=${style}.` +
    ` Buat 6 scenes. Tiap scene: id, title, narrative (2-3 kalimat), imagePromptA, imagePromptB.` +
    ` imagePrompt harus menggambarkan scene sebagai "clean dark cinematic diorama" (tapi tetap realistis).`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [
        { role: "user", parts: [{ text: `${sys}\n\nTOPIC:\n${topic}\n\nOUTPUT JSON:` }] },
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1800 },
    }),
  });

  if (r.status === 429) return NextResponse.json({ ok: false, error: "RESOURCE_EXHAUSTED" }, { status: 429 });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return NextResponse.json({ ok: false, error: `GEMINI_HTTP_${r.status}:${t.slice(0, 200)}` }, { status: 400 });
  }

  const j = await r.json().catch(() => ({} as any));
  const text =
    j?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("") || "";

  const raw = pickJson(text);
  if (!raw) return NextResponse.json({ ok: false, error: "JSON_PARSE_FAILED", raw: text.slice(0, 500) }, { status: 400 });

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "JSON_INVALID", raw: raw.slice(0, 500) }, { status: 400 });
  }

  const scenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
  const normalized = scenes.slice(0, 12).map((s: any, i: number) => ({
    id: String(s?.id || `scene_${i + 1}`),
    title: String(s?.title || `Scene ${i + 1}`),
    narrative: String(s?.narrative || ""),
    imagePromptA: String(s?.imagePromptA || ""),
    imagePromptB: String(s?.imagePromptB || ""),
  }));

  return NextResponse.json({ ok: true, scenes: normalized });
}
