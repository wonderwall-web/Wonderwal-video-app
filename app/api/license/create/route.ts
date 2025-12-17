import { NextResponse } from "next/server"
import { LICENSES } from "@/app/lib/licenses"

function generateLicense() {
  const part = () =>
    Math.random().toString(36).substring(2, 6).toUpperCase()
  return `LIC-${part()}-${part()}`
}

export async function POST() {
  const license = generateLicense()

  LICENSES.set(license, {
    email: "",
    device: null
  })

  return NextResponse.json({ license })
}
