import { NextResponse } from "next/server"
import { sendLicenseEmail } from "@/app/lib/mailer"

const GSHEET_URL =
  "https://script.google.com/macros/s/AKfycbxZ4C4pUsaUuFFaXlWNhLj_17lwqADhiD-6ozSQzi4zJVCFEnUMXWigPycdUXxkcUCfbw/exec"

export async function POST(req: Request) {
  const body = await req.json()

  // 1️⃣ cek secret
  if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
    return NextResponse.json(
      { ok: false, error: "BAD_SECRET" },
      { status: 401 }
    )
  }

  // 2️⃣ generate license
  const license =
    "LIC-" + Math.random().toString(36).substring(2, 8).toUpperCase()

  // 3️⃣ KIRIM KE GOOGLE SHEET (PAKAI URL YANG LO KASIH)
  const res = await fetch(GSHEET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: body.email,
      license,
      source: "lynk"
    })
  })

  const text = await res.text()

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: "SHEET_FAILED", response: text },
      { status: 500 }
    )
  }

  // 4️⃣ EMAIL KE BUYER
  await sendLicenseEmail(body.email, license)

  return NextResponse.json({
    ok: true,
    license,
    sheet: text
  })
}
