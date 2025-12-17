import { NextResponse } from "next/server"

function gen() {
  return Math.random().toString(36).substring(2, 6).toUpperCase()
}

export async function POST() {
  const license = `LIC-${gen()}-${gen()}`
  return NextResponse.json({ license })
}
