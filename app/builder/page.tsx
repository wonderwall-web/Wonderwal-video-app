import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getApiKey(req: Request, body: any) {
  const h = req.headers.get("x-api-key") || "";
  return (
    (body?.apiKey as string) ||
    (body?.key as string) ||
    h ||
    (process.env.GEMINI_API_KEY as string) ||
    ""
  ).trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").trim();
    const apiKey = getApiKey(req, body);

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "missing_api_key", version: "gen-v2-debug-20260112" },
        { status: 400 }
      );
    }
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "missing_prompt", version: "gen-v2-debug-20260112" },
        { status: 400 }
      );
    }

    const model = String(process.env.GEMINI_MODEL || "gemini-1.5-flash").trim();

    const url = `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
      }),
    });

    const data = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "gemini_http_error",
          status: upstream.status,
          version: "gen-v2-debug-20260112",
          details: data?.error || data,
        },
        { status: upstream.status }
      );
    }

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text)
        .filter(Boolean)
        .join("") || "";

    return NextResponse.json({
      ok: true,
      output: text,
      version: "gen-v2-debug-20260112",
      model,
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        version: "gen-v2-debug-20260112",
        message: e?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
