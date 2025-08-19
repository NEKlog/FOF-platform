import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // statiske filer/Next-internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    pathname.match(/\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|map|txt)$/)
  ) return NextResponse.next();

  // altid åbne API’er (login/registrering, geo, aktivering)
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/geo/") ||
    pathname.startsWith("/api/customer/tasks/activate")
  ) return NextResponse.next();

  // beskyt kun egentlige customer-API’er
  if (pathname.startsWith("/api/customer/")) {
    const token = req.cookies.get("auth")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }

  // alle pages er åbne (hele booking-flowet kan nå step 3)
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!.*\\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|map|txt)$).*)"],
};
