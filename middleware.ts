import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // DEV MODE: jangan blok apa pun di localhost (biar kamu bisa lanjut ngerjain builder)
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;

  // allow public
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/settings")
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get("ww_session")?.value || "";

  // Protect builder in production
  if (pathname.startsWith("/builder")) {
    if (session !== "ok") {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  // If already logged in, "/" -> "/builder"
  if (pathname === "/" && session === "ok") {
    const url = req.nextUrl.clone();
    url.pathname = "/builder";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
