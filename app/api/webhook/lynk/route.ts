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

  await fetch("https://script.google.com/macros/s/AKfycbwoHCa-bdGHYI8CtwilnYbpxAYh60ECYmxaHYeLJzcV/exec", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, license })
  })

  return NextResponse.json({ ok: true, email, license })
}
