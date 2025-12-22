import { NextResponse } from "next/server"
import { LICENSES } from "@/app/lib/licenses"

export async function POST(req: Request) {
  const { email, license } = await req.json()

  const device =
    req.headers.get("user-agent") || "unknown-device"

  // ❌ license tidak ada
  const data = LICENSES.get(license)
  if (!data) {
    return NextResponse.json(
      { ok: false, error: "INVALID_LICENSE" },
      { status: 401 }
    )
  }

  // 🔒 lock device pertama
  if (!data.device) {
    data.device = device
    data.email = email
  } else if (data.device !== device) {
    return NextResponse.json(
      { ok: false, error: "DEVICE_LOCKED" },
      { status: 403 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: "ACCESS_GRANTED"
  })
}
