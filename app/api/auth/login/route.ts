import { NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import { LICENSES } from "@/app/lib/licenses"

export async function POST(req: Request) {
  const { email, license, device } = await req.json()

  const data = LICENSES.get(license)
  if (!data) {
    return NextResponse.json(
      { error: "INVALID_LICENSE" },
      { status: 401 }
    )
  }

  // 🔒 lock 1 device
  if (!data.device) {
    data.device = device
  } else if (data.device !== device) {
    return NextResponse.json(
      { error: "DEVICE_BLOCKED" },
      { status: 403 }
    )
  }

  data.email = email

  const token = jwt.sign(
    { email, license },
    process.env.JWT_SECRET!,
    { expiresIn: "24h" }
  )

  const res = NextResponse.json({ ok: true })

  res.cookies.set("token", token, {
    httpOnly: true,
    path: "/",
    maxAge: 60 * 60 * 24
  })

  return res
}
