import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "ww_session";

export function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/builder/:path*"],
};
