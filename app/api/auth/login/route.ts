import { NextResponse } from "next/server"
import { LICENSES } from "@/app/lib/licenses"

export async function POST(req: Request) {
  const { email, license, device } = await req.json()

  const data = LICENSES.get(license)

  if (!data || !data.active || data.email !== email) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  if (!data.device) {
    data.device = device
  } else if (data.device !== device) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
