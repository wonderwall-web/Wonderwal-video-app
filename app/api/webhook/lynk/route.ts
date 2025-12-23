import { NextResponse } from "next/server"
import { sendLicenseEmail } from "@/app/lib/mailer"

const GSHEET_URL =
  "https://script.google.com/macros/s/AKfycbwhiHe8Ic3kXNzdeUtoxx8MFz7Dp9bZJTrNL1qXAQ_qp3E8fAp3-5zjT6_jrXTuMrkYQQ/exec"

export async function POST(req: Request) {
  const body = await req.json()

  if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const license =
    "LIC-" + Math.random().toString(36).substring(2, 8).toUpperCase()

  // 1) Simpan ke Google Sheet
  await fetch(GSHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      license,
      source: "lynk"
    })
  })

  // 2) Kirim email via SMTP
  await sendLicenseEmail(body.email, license)

  return NextResponse.json({ ok: true, license })
}
