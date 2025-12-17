import { NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(req: Request) {
  const body = await req.json()

  if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const license =
    "LIC-" +
    crypto.randomBytes(4).toString("hex").toUpperCase()

  return NextResponse.json({
    ok: true,
    email: body.email,
    license
  })
}
