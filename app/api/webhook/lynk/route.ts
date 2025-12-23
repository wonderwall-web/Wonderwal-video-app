import { NextResponse } from "next/server"
import { sendLicenseEmail } from "@/app/lib/mailer"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    if (body.secret !== process.env.LYNK_WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false, error: "BAD_SECRET" }, { status: 401 })
    }

    const license =
      "LIC-" + Math.random().toString(36).substring(2, 8).toUpperCase()

    // 🔥 PAKSA POST KE GOOGLE SHEET
    const res = await fetch(
      "https://script.google.com/macros/s/AKfycbxZ4C4pUsaUuFFaXlWNhLj_17lwqADhiD-6ozSQzi4zJVCFEnUMXWigPycdUXxkcUCfbw/exec",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: body.email,
          license,
          source: "lynk",
        }),
      }
    )

    const text = await res.text()

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: "GOOGLE_SHEET_FAILED",
        response: text,
      }, { status: 500 })
    }

    // 📧 EMAIL
    await sendLicenseEmail(body.email, license)

    return NextResponse.json({
      ok: true,
      license,
      sheet_response: text,
    })
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message || "UNKNOWN_ERROR",
    }, { status: 500 })
  }
}
