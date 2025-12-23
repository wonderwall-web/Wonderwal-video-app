import { NextResponse } from "next/server"
import { sendLicenseEmail } from "@/app/lib/mailer"

const GSHEET_URL =
  "https://script.google.com/macros/s/AKfycbwhiHe8Ic3kXNzdeUtoxx8MFz7Dp9bZJTrNL1qXAQ_qp3E8fAp3-5zjT6_jrXTuMrkYQQ/exec"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // 1) cek secret
    if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
      return NextResponse.json(
        { ok: false, error: "BAD_SECRET" },
        { status: 401 }
      )
    }

    const license =
      "LIC-" + Math.random().toString(36).substring(2, 8).toUpperCase()

    // 2) kirim ke Google Sheet
    const sheetRes = await fetch(GSHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: body.email,
        license,
        source: "lynk"
      })
    })

    const sheetText = await sheetRes.text()

    if (!sheetRes.ok) {
      return NextResponse.json({
        ok: false,
        step: "sheet",
        status: sheetRes.status,
        response: sheetText
      })
    }

    // 3) kirim email
    try {
      await sendLicenseEmail(body.email, license)
    } catch (mailErr: any) {
      return NextResponse.json({
        ok: false,
        step: "email",
        error: mailErr?.message || "EMAIL_FAILED"
      })
    }

    // 4) sukses
    return NextResponse.json({
      ok: true,
      license,
      sheet: sheetText
    })

  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      step: "unknown",
      error: err?.message || String(err)
    })
  }
}
