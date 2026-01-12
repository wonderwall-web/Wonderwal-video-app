import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const apiKey = String(body.apiKey || "").trim();
  const prompt = String(body.prompt || "").trim();

  if (!apiKey) return NextResponse.json({ ok: false, error: "missing_api_key" }, { status: 400 });
  if (!prompt) return NextResponse.json({ ok: false, error: "missing_prompt" }, { status: 400 });

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

  const text = await r.text();
  let data: any = {};
  try { data = JSON.parse(text); } catch {}

  const out =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ||
    "";

  return NextResponse.json({ ok: true, output: out });
}
