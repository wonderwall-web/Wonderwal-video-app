import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { secret, email } = await req.json()

  // VALIDASI SECRET
  if (secret !== "lynk_rahasia_123") {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  if (!email) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // GENERATE LICENSE
  const license =
    "LIC-" +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()

  // KIRIM KE GOOGLE SHEET (WEB APP /exec)
  await fetch(
    "https://script.google.com/macros/s/AKfycbwi9tbVrY1u0zfiZycKZ1QytPUnFn7oP9EYOiDKwdGDK2ULFgsQZVWp0ejHggVedrECOA/exec",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        license
      })
    }
  )

  return NextResponse.json({
    ok: true,
    email,
    license
  })
}
