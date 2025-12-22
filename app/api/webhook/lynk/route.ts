import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()

  if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const license = "LIC-" + Math.random().toString(36).substring(2, 8).toUpperCase()

  await fetch(process.env.LYNK_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      license,
      source: "lynk"
    })
  })

  return NextResponse.json({
    ok: true,
    license
  })
}
