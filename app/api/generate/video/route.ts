import { NextResponse } from "next/server"
import { checkLimit } from "@/app/lib/limits"

export async function POST(req: Request) {
  const license = req.headers.get("x-license")

  if (!license) {
    return NextResponse.json(
      { error: "NO_LICENSE" },
      { status: 401 }
    )
  }

  if (!license.startsWith("LIC-")) {
    return NextResponse.json(
      { error: "INVALID_LICENSE" },
      { status: 403 }
    )
  }

  const limit = checkLimit(license, 4)
  if (!limit.ok) {
    return NextResponse.json(
      { error: "LIMIT_REACHED" },
      { status: 429 }
    )
  }

  return NextResponse.json({
    ok: true,
    left_today: limit.left
  })
}
