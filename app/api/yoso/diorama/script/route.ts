import { NextResponse } from "next/server";
import { callGeminiWithRotation } from "../../../../../lib/geminiService";

export const runtime = "nodejs";

function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/* =========================================================
   Prompt builder (strict JSON contract)
========================================================= */
function buildPrompt(input: {
  topic: string;
  style: string;
  format: string;
  audience: string;
  genre: string;
  template: string;
}) {
  const { topic, style, format, audience, genre, template } = input;

  return `
You are "AI Studio Script Generator" for YosoApp (YOSOApps the Viral Creator).

Return ONLY valid JSON. No markdown. No explanations. No code fences.

The JSON structure MUST be:
{
  "scenes": [
    {
      "id": "scene-1",
      "narrative": "...",
      "imagePromptA": "...",
      "imagePromptB": "...",
      "videoPrompt": "..."
    }
    ... exactly 9 scenes
  ]
}

STRICT RULES:
- Total scenes MUST be exactly 9.
- Every field must exist and be non-empty string.
- narrative: Indonesian, cinematic documentary style, dense and evocative.
- imagePromptA/B: ENGLISH photorealistic historical miniature diorama, macro tilt-shift, shallow depth of field, visible physical textures (moss, dust, cracked wood, mud, stone), documentary lighting, no CGI look, no human hands, crowded tiny figures.
- videoPrompt: ENGLISH, 1–2 sentences, cinematic camera movement (push-in, crane, tracking).

Context:
topic: ${topic}
style: ${style}
format: ${format}
audience: ${audience}
genre: ${genre}
template: ${template}

Now output JSON only.
`.trim();
}

/* =========================================================
   Route
========================================================= */
export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const topic = String(body?.topic || "").trim();
  const style = String(body?.style || "").trim();
  const format = String(body?.format || "").trim();
  const audience = String(body?.audience || "").trim();
  const genre = String(body?.genre || "").trim();
  const template = String(body?.template || "").trim();

  const missing = [];
  if (!topic) missing.push("topic");
  if (!style) missing.push("style");
  if (!format) missing.push("format");
  if (!audience) missing.push("audience");
  if (!genre) missing.push("genre");
  if (!template) missing.push("template");

  if (missing.length) {
    return json({ ok: false, error: "MISSING_FIELDS", missing }, 400);
  }

  /* =====================================================
     Accept API keys from request body (settings page)
  ===================================================== */
  let keys: string[] = [];

  if (Array.isArray(body?.apiKeys)) {
    keys = body.apiKeys.map((k: any) => String(k || "").trim()).filter(Boolean);
  } else {
    keys = [
      body?.apiKey1,
      body?.apiKey2,
      body?.apiKey3,
      body?.apiKey4,
      body?.apiKey5,
    ]
      .map((k: any) => String(k || "").trim())
      .filter(Boolean);
  }

  if (!keys.length) {
    return json(
      {
        ok: false,
        error: "API_KEY_MISSING",
        message: "apiKeys[] or apiKey1..apiKey5 must be provided",
      },
      400
    );
  }

  /* =====================================================
     Call Gemini
  ===================================================== */
  const prompt = buildPrompt({
    topic,
    style,
    format,
    audience,
    genre,
    template,
  });

  const result = await callGeminiWithRotation({
    keys,
    prompt,
  });

  if (!result.ok) {
    return json({
      ok: false,
      error: result.error,
      raw: result.raw,
    }, 500);
  }

  /* =====================================================
     Validate JSON strictly
  ===================================================== */
  const jsonData = result.json;

  if (!jsonData || typeof jsonData !== "object") {
    return json(
      { ok: false, error: "JSON_INVALID", raw: result.text?.slice(0, 2000) },
      500
    );
  }

  const scenes = jsonData?.scenes;

  if (!Array.isArray(scenes)) {
    return json(
      { ok: false, error: "SCENES_NOT_ARRAY", raw: jsonData },
      500
    );
  }

  if (scenes.length !== 9) {
    return json(
      { ok: false, error: "SCENES_COUNT_INVALID", count: scenes.length, raw: jsonData },
      500
    );
  }

  for (const [i, s] of scenes.entries()) {
    if (
      !s ||
      typeof s.id !== "string" ||
      typeof s.narrative !== "string" ||
      typeof s.imagePromptA !== "string" ||
      typeof s.imagePromptB !== "string" ||
      typeof s.videoPrompt !== "string"
    ) {
      return json(
        { ok: false, error: "SCENE_FIELD_INVALID", index: i, raw: s },
        500
      );
    }
  }

  /* =====================================================
     Success
  ===================================================== */
  return json({
    ok: true,
    scenes,
    meta: { topic, style, format, audience, genre, template },
    usedKeyIndex: result.usedKeyIndex,
  });
}
