import { NextResponse } from "next/server"
import { LICENSES } from "@/app/lib/licenses"

function generateLicense() {
  const part = () =>
    Math.random().toString(36).substring(2, 6).toUpperCase()
  return `LIC-${part()}-${part()}`
}

export async function POST(req: Request) {
  const body = await req.json()

  // 🛑 VALIDASI TOKEN WEBHOOK
  if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const email = body.email
  if (!email) {
    return NextResponse.json({ error: "NO_EMAIL" }, { status: 400 })
  }

  const license = generateLicense()

  LICENSES.set(license, {
    email,
    device: null
  })

  // (OPSIONAL) kirim email di sini

  return NextResponse.json({
    ok: true,
    license
  })
}
