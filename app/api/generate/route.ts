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

async function callGemini(apiKey: string, model: string, prompt: string) {
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
    return {
      ok: false as const,
      status: upstream.status,
      details: data?.error || data,
    };
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      .filter(Boolean)
      .join("") || "";

  return { ok: true as const, text };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").trim();
    const apiKey = getApiKey(req, body);

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "missing_api_key", version: "gen-v3-20260112" },
        { status: 400 }
      );
    }
    if (!prompt) {
      return NextResponse.json(
        { ok: false, error: "missing_prompt", version: "gen-v3-20260112" },
        { status: 400 }
      );
    }

    const envModel = String(process.env.GEMINI_MODEL || "").trim();

    // Fallback chain (paling aman → paling kompatibel)
    const candidates = [
      envModel,
      "gemini-2.5-flash-lite",
      "gemini-2.5-flash",
      "gemini-1.5-flash-001",
      "gemini-1.5-pro-001",
    ].filter(Boolean);

    let lastErr: any = null;

    for (const model of candidates) {
      const r = await callGemini(apiKey, model, prompt);

      if (r.ok) {
        return NextResponse.json({
          ok: true,
          output: r.text,
          model,
          version: "gen-v3-20260112",
        });
      }

      lastErr = { model, ...r };

      // Kalau bukan 404, jangan lanjut fallback (biar error asli kelihatan)
      if (r.status !== 404) {
        return NextResponse.json(
          {
            ok: false,
            error: "gemini_http_error",
            status: r.status,
            version: "gen-v3-20260112",
            model,
            details: r.details,
          },
          { status: r.status }
        );
      }
    }

    // Semua kandidat 404
    return NextResponse.json(
      {
        ok: false,
        error: "gemini_model_not_found",
        status: 404,
        version: "gen-v3-20260112",
        tried_models: candidates,
        last_error: lastErr?.details || lastErr,
      },
      { status: 404 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "server_error",
        version: "gen-v3-20260112",
        message: e?.message || "Unknown error",
      },
      { status: 500 }
    );
  }
}
