import { NextResponse } from "next/server"

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

  return NextResponse.json({
    ok: true,
    license
  })
}
