import { NextResponse } from "next/server"
import { sendLicenseEmail } from "@/app/lib/mailer"

export async function POST(req: Request) {
  const body = await req.json()

  // 🔐 security webhook
  if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const license =
    "LIC-" + Math.random().toString(36).substring(2, 8).toUpperCase()

  // 1️⃣ KIRIM KE GOOGLE SHEET (INI YANG TADI HILANG)
  await fetch(process.env.LYNK_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      license,
      source: "lynk"
    })
  })

  // 2️⃣ KIRIM EMAIL KE BUYER
  await sendLicenseEmail(body.email, license)

  // 3️⃣ RESPONSE KE LYNK
  return NextResponse.json({
    ok: true,
    license
  })
}
