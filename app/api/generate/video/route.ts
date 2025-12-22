import { NextResponse } from "next/server"
import { LICENSES } from "@/app/lib/licenses"

export async function POST(req: Request) {
  const license = req.headers.get("x-license")

  if (!license) {
    return NextResponse.json({ error: "NO_LICENSE" }, { status: 401 })
  }

  const data = LICENSES.get(license)

  if (!data || !data.active) {
    return NextResponse.json({ error: "INVALID_LICENSE" }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    video: "generated.mp4"
  })
}
