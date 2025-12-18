import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()
  const { secret, email } = body

  // 🔒 VALIDASI SECRET
  if (secret !== process.env.LYNK_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    )
  }

  if (!email) {
    return NextResponse.json(
      { ok: false, error: "EMAIL_REQUIRED" },
      { status: 400 }
    )
  }

  // 🎫 GENERATE LICENSE SIMPLE
  const license =
    "LIC-" +
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    "-" +
    Math.random().toString(36).substring(2, 6).toUpperCase()

  return NextResponse.json({
    ok: true,
    email,
    license
  })
}
