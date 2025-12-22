import { NextResponse } from "next/server"
import { LICENSES } from "@/app/lib/licenses"

function gen() {
  return "LIC-" + Math.random().toString(36).substring(2, 6).toUpperCase()
}

export async function POST() {
  const license = gen()

  LICENSES.set(license, {
    email: "",
    device: null
  })

  return NextResponse.json({
    ok: true,
    license
  })
}
