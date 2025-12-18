import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { secret, email } = await req.json()

  // PAKSA SECRET (BUKAN ENV)
  if (secret !== "lynk_rahasia_123") {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  if (!email) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const license =
    "LIC-" +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()

  return NextResponse.json({
    ok: true,
    email,
    license
  })
}
