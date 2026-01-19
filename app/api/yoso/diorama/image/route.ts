import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const apiKey = String(body?.apiKey || "").trim();
  const prompt = String(body?.prompt || "").trim();
  const style = String(body?.style || "ERA_KOLONIAL").trim();
  const aspectRatio = String(body?.aspectRatio || "16:9").trim(); // "16:9" | "9:16" | "1:1"
  const refImageBase64 = String(body?.refImageBase64 || "").trim(); // optional base64 jpeg

  if (!apiKey) return NextResponse.json({ ok: false, error: "API_KEY_MISSING" }, { status: 400 });
  if (!prompt) return NextResponse.json({ ok: false, error: "PROMPT_MISSING" }, { status: 400 });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const parts: any[] = [];
  if (refImageBase64) {
    parts.push({ inlineData: { mimeType: "image/jpeg", data: refImageBase64 } });
  }
  parts.push({ text: prompt });

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      config: { imageConfig: { aspectRatio: aspectRatio as any } },
    }),
  });

  if (r.status === 429) return NextResponse.json({ ok: false, error: "RESOURCE_EXHAUSTED" }, { status: 429 });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return NextResponse.json({ ok: false, error: `GEMINI_HTTP_${r.status}:${t.slice(0, 240)}` }, { status: 400 });
  }

  const j = await r.json().catch(() => ({} as any));

  const partsOut = j?.candidates?.[0]?.content?.parts || [];
  for (const p of partsOut) {
    if (p?.inlineData?.data) {
      return NextResponse.json({
        ok: true,
        mimeType: String(p.inlineData.mimeType || "image/png"),
        data: String(p.inlineData.data),
        meta: { style, aspectRatio },
      });
    }
  }

  return NextResponse.json({ ok: false, error: "NO_IMAGE_RETURNED" }, { status: 400 });
}
