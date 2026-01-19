import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  const license = String(body?.license || "").trim();
  const device = String(body?.device || "").trim();
  const prompt = String(body?.prompt || "").trim();
  const apiKey = String(body?.apiKey || "").trim();

  if (!license || !device || !prompt) {
    return NextResponse.json(
      { ok: false, error: "MISSING_FIELDS", required: ["license", "device", "prompt"] },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "API_KEY_MISSING" }, { status: 400 });
  }

  // Validate license+device via Apps Script
  const base = (process.env.LICENSE_API_URL || "").trim();
  if (!base) return NextResponse.json({ ok: false, error: "ENV_MISSING" }, { status: 500 });

  const vurl = `${base}?license=${encodeURIComponent(license)}&device=${encodeURIComponent(device)}`;
  const vr = await fetch(vurl);
  const vdata = await vr.json().catch(() => ({} as any));

  const valid = vdata?.ok === true && (vdata?.status === "OK" || vdata?.status === "BOUND" || vdata?.valid === true);
  if (!valid) {
    return NextResponse.json({ ok: false, error: vdata?.status || vdata?.error || "LICENSE_INVALID" }, { status: 401 });
  }

  // Dummy OK (kalau kamu masih dummy), atau call Gemini beneran:
  const gurl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

  const gr = await fetch(gurl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 256 },
    }),
  });

  if (gr.status === 429) {
    return NextResponse.json({ ok: false, error: "RESOURCE_EXHAUSTED" }, { status: 429 });
  }

  if (!gr.ok) {
    const t = await gr.text().catch(() => "");
    return NextResponse.json({ ok: false, error: `GEMINI_HTTP_${gr.status}:${t.slice(0, 200)}` }, { status: 400 });
  }

  const gdata = await gr.json().catch(() => ({} as any));
  const text =
    gdata?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join("") || "";

  return NextResponse.json({ ok: true, text });
}
