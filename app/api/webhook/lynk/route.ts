import { NextResponse } from "next/server"
import { sendLicenseEmail } from "@/app/lib/mailer"

export async function POST(req: Request) {
  const body = await req.json()

  if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const license =
    "LIC-" + Math.random().toString(36).substring(2, 8).toUpperCase()

  // kirim email otomatis
  await sendLicenseEmail(body.email, license)

  return NextResponse.json({
    ok: true,
    license
  })
}
