import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { license } = await req.json()

  const ok =
    typeof license === "string" &&
    license.startsWith("LIC-") &&
    license.length === 13

  if (!ok) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
