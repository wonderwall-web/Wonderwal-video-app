import { NextRequest, NextResponse } from "next/server";
import { getSessionCookieName, verifySession } from "@/lib/auth";

export function middleware(req: NextRequest) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) return NextResponse.redirect(new URL("/login", req.url));

  const token = req.cookies.get(getSessionCookieName())?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  const payload = verifySession(token, sessionSecret);
  if (!payload) return NextResponse.redirect(new URL("/login", req.url));

  return NextResponse.next();
}

export const config = {
  matcher: ["/builder/:path*"],
};
