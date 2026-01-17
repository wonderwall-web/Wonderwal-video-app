import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { apiKey } = await req.json();
    const key = String(apiKey || "").trim();
    if (!key) return NextResponse.json({ error: "NO_API_KEY" }, { status: 400 });

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
    const r = await fetch(url, { method: "GET" });

    if (r.status === 429) {
      return NextResponse.json({ error: "RESOURCE_EXHAUSTED", status: 429 }, { status: 429 });
    }

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return NextResponse.json({ error: "PING_FAILED", status: r.status, detail: t.slice(0, 400) }, { status: r.status });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }
}
