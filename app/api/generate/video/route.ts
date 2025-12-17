import { NextResponse } from "next/server"

function validLicense(license: string | undefined) {
  return (
    typeof license === "string" &&
    license.startsWith("LIC-") &&
    license.length === 13
  )
}

export async function POST(req: Request) {
  const license = req.headers.get("x-license") || ""

  if (!validLicense(license)) {
    return NextResponse.json(
      { error: "INVALID_LICENSE" },
      { status: 403 }
    )
  }

  // 🔒 API PRODUKSI AMAN
  return NextResponse.json({
    ok: true,
    message: "VIDEO GENERATED (DUMMY)"
  })
}
