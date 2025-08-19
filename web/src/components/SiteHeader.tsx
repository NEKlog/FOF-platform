// Server Component
import Link from "next/link";
import Image from "next/image";
import { getUserFromCookie } from "@/lib/auth";

export default async function SiteHeader() {
  const me = await getUserFromCookie();
  const role = me?.role ? String(me.role).toUpperCase() : undefined;

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        {/* Brand -> always send to landing page */}
        <Link href="/" className="brand" aria-label="Gå til forsiden">
          <Image
            src="/billeder/Transparent Logo.svg"
            alt="Flytte & Fragttilbud"
            width={160}
            height={40}
            priority
            className="brand__logo"
          />
          <span className="brand__text">Flytte & Fragttilbud</span>
        </Link>

        {/* Right-side nav */}
        <nav className="header-nav">
          {/* CTA everyone can use (guest too) */}
          <Link className="btn btn--ghost" href="/customer/book">
            Book opgave
          </Link>

          {/* Role-specific shortcuts when logged in */}
          {role ? (
            <>
              {role === "ADMIN" && (
                <Link className="btn btn--ghost" href="/admin">
                  Admin
                </Link>
              )}
              {role === "CARRIER" && (
                <Link className="btn btn--ghost" href="/carrier">
                  Carrier
                </Link>
              )}
              {role === "CUSTOMER" && (
                <Link className="btn btn--ghost" href="/customer">
                  Mine opgaver
                </Link>
              )}

              {/* Logout (POST) */}
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="btn btn--primary">
                  Log ud
                </button>
              </form>
            </>
          ) : (
            <Link className="btn btn--primary" href="/login">
              Log ind
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
