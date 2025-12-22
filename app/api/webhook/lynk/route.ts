import { NextResponse } from "next/server"
import { LICENSES } from "@/app/lib/licenses"

export async function POST(req: Request) {
  const body = await req.json()

  if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const license = "LIC-" + Math.random().toString(36).substring(2, 8).toUpperCase()

  LICENSES.set(license, {
    email: body.email,
    device: null,
    active: true
  })

  return NextResponse.json({
    ok: true,
    license
  })
}
