import { NextResponse } from "next/server"
import { LICENSES } from "@/app/lib/licenses"
import { checkLimit } from "@/app/lib/limits"

export async function POST(req: Request) {
  const license = req.headers.get("x-license") || ""
  const device = req.headers.get("user-agent") || "unknown"

  const data = LICENSES.get(license)
  if (!data) {
    return NextResponse.json(
      { error: "INVALID_LICENSE" },
      { status: 401 }
    )
  }

  // 🔒 device lock
  if (!data.device) {
    data.device = device
  } else if (data.device !== device) {
    return NextResponse.json(
      { error: "DEVICE_LOCKED" },
      { status: 403 }
    )
  }

  // ⏱️ LIMIT: 5 per hari
  const ok = checkLimit(license, 5)
  if (!ok) {
    return NextResponse.json(
      { error: "LIMIT_REACHED" },
      { status: 429 }
    )
  }

  // 🎬 dummy generate (nanti ganti AI Studio)
  return NextResponse.json({
    ok: true,
    message: "GENERATE OK",
    remaining: "cek besok"
  })
}
