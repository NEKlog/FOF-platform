import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
const COOKIE = "auth";

// hvilke prefixes der kræver login / rolle
const PUBLIC = ["/login", "/api/auth/login", "/api/auth/register", "/api/auth/logout", "/_next", "/favicon", "/api/dev"]; // udvid efter behov
const ROLE_PREFIX = {
  "/admin": ["ADMIN"],
  "/carrier": ["CARRIER"],
  "/customer": ["CUSTOMER"],
};

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // offentlige paths
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // kræver login? (admin/carrier/customer dashboard + jeres beskyttede API’er)
  const needsAuth =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/carrier") ||
    pathname.startsWith("/customer") ||
    pathname.startsWith("/api");

  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    const { payload } = await jwtVerify(token, SECRET);
    const role = String(payload.role || "").toUpperCase();
    const approved = Boolean(payload.approved);
    const active = Boolean(payload.active);

    if (!approved || !active) {
      return NextResponse.redirect(new URL("/login?m=inactive", req.url));
    }

    // rollekrav per prefix
    for (const prefix in ROLE_PREFIX) {
      if (pathname.startsWith(prefix)) {
        const allowed = ROLE_PREFIX[prefix as keyof typeof ROLE_PREFIX];
        if (!allowed.includes(role)) {
          return NextResponse.redirect(new URL("/login?m=forbidden", req.url));
        }
      }
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/"], // alt undtagen statiske
};
