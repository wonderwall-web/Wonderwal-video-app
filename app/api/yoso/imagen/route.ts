import { NextResponse } from "next/server";

export const runtime = "nodejs";

function jsonOk(data: any, status = 200) {
  return new NextResponse(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function stripKeyList(keys: any): string[] {
  if (!Array.isArray(keys)) return [];
  return keys.map((k) => String(k || "").trim()).filter(Boolean);
}

function isRateLimit(status: number, rawText: string) {
  const t = (rawText || "").toLowerCase();
  return status === 429 || t.includes("resource_exhausted") || t.includes("quota") || t.includes("429");
}

function isInvalidKey(status: number, rawText: string) {
  const t = (rawText || "").toLowerCase();
  return status === 401 || status === 403 || t.includes("api key not valid") || t.includes("permission");
}

async function callImagenOnce(opts: {
  apiKey: string;
  prompt: string;
  aspectRatio?: "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
  imageSize?: "1K" | "2K";
  personGeneration?: "dont_allow" | "allow_adult" | "allow_all";
  sampleCount?: 1 | 2 | 3 | 4;
  model?: string; // default imagen-4.0-generate-001
}) {
  const model = String(opts.model || "imagen-4.0-generate-001").trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:predict`;

  const body = {
    instances: [{ prompt: opts.prompt }],
    parameters: {
      sampleCount: (opts.sampleCount ?? 1) as 1 | 2 | 3 | 4,
      aspectRatio: (opts.aspectRatio ?? "9:16") as any,
      imageSize: (opts.imageSize ?? "1K") as any,
      personGeneration: (opts.personGeneration ?? "allow_adult") as any,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": opts.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    return { ok: false as const, status: res.status, rawText: text || res.statusText, raw: json || text };
  }

  const preds = json?.predictions;
  const first = Array.isArray(preds) ? preds[0] : null;
  const b64 = first?.bytesBase64Encoded || null;
  const mime = first?.mimeType || "image/png";

  if (!b64) {
    return { ok: false as const, status: 200, rawText: "EMPTY_IMAGE_BYTES", raw: json };
  }

  return {
    ok: true as const,
    status: 200,
    image: {
      base64: String(b64),
      mimeType: String(mime),
      dataUrl: `data:${mime};base64,${String(b64)}`,
    },
  };
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const apiKeys = stripKeyList(body?.apiKeys);
  const prompt = String(body?.prompt || "").trim();

  const aspectRatio = (String(body?.aspectRatio || "9:16").trim() as any) || "9:16";
  const imageSize = (String(body?.imageSize || "1K").trim() as any) || "1K";
  const personGeneration = (String(body?.personGeneration || "allow_adult").trim() as any) || "allow_adult";
  const model = String(body?.model || "imagen-4.0-generate-001").trim();

  const sampleCountRaw = Number(body?.sampleCount ?? 1);
  const sampleCount = ([1, 2, 3, 4].includes(sampleCountRaw) ? sampleCountRaw : 1) as 1 | 2 | 3 | 4;

  if (!prompt) return jsonOk({ ok: false, error: "PROMPT_MISSING" }, 400);
  if (!apiKeys.length) return jsonOk({ ok: false, error: "API_KEY_MISSING" }, 400);

  const errors: any[] = [];

  for (let ki = 0; ki < apiKeys.length; ki++) {
    const key = apiKeys[ki];

    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await callImagenOnce({
        apiKey: key,
        prompt,
        aspectRatio,
        imageSize,
        personGeneration,
        sampleCount,
        model,
      });

      if (r.ok) {
        return jsonOk({
          ok: true,
          usedKeyIndex: ki,
          model,
          image: r.image,
        });
      }

      const status = r.status || 0;
      const rawText = String(r.rawText || "");

      if (isInvalidKey(status, rawText)) {
        errors.push({ keyIndex: ki, attempt, error: "INVALID_API_KEY", status, raw: r.raw });
        break;
      }

      if (isRateLimit(status, rawText)) {
        errors.push({ keyIndex: ki, attempt, error: "RATE_LIMIT", status, raw: r.raw });
        if (attempt < 2) {
          await delay(Math.pow(2, attempt) * 1200);
          continue;
        }
        break;
      }

      errors.push({ keyIndex: ki, attempt, error: "IMAGEN_ERROR", status, raw: r.raw });
      if (attempt < 2) {
        await delay(600 * (attempt + 1));
        continue;
      }
      break;
    }

    if (ki < apiKeys.length - 1) await delay(250);
  }

  const allRate = errors.length > 0 && errors.every((x) => String(x?.error).includes("RATE_LIMIT"));
  if (allRate) return jsonOk({ ok: false, error: "ALL_KEYS_RATE_LIMITED", raw: errors }, 429);

  return jsonOk({ ok: false, error: "ALL_ATTEMPTS_FAILED", raw: errors }, 500);
}
