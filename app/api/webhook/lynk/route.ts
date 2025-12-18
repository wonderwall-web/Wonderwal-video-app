import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { secret, email } = await req.json()

  if (secret !== "lynk_rahasia_123") {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const license =
    "LIC-" +
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    "-" +
    Math.random().toString(36).slice(2, 6).toUpperCase()

  // 🔔 KIRIM KE GOOGLE SHEET
  await fetch("https://script.google.com/u/0/home/projects/1NEZtUIDUD1fMeDsqMHhSc5svcJiNCbChxC1SYI6XFGlFAN93fcmpc83r/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      license
    })
  })

  return NextResponse.json({
    ok: true,
    email,
    license
  })
}
