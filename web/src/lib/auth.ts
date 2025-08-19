// src/lib/auth.ts
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/db";

const AUTH_COOKIE = "auth";

type JWTPayload = {
  sub: string;          // bruger-id som string
  role: string;         // "ADMIN" | "CUSTOMER" | "CARRIER"
  approved?: boolean;
  active?: boolean;
};

const days = Number(process.env.JWT_EXPIRES_DAYS || 7);

export async function signToken(payload: JWTPayload): Promise<string> {
  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET");
  }
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: `${days}d` });
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    if (!process.env.JWT_SECRET) return null;
    return jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const store = (await cookies()) as any; // skrivbar i route handlers
  store.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * days,
  });
}

export async function clearAuthCookie() {
  const store = (await cookies()) as any;
  store.set(AUTH_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getUserFromCookie() {
  const store = await cookies();
  const token = (store as any).get(AUTH_COOKIE)?.value as string | undefined;
  if (!token) return null;

  const decoded = await verifyToken(token);
  if (!decoded?.sub) return null;

  const id = Number(decoded.sub);
  if (!Number.isFinite(id)) return null;

  const user = await prisma.user.findUnique({ where: { id } });
  return user ?? null;
}

// Små role-guards til admin/carrier routes
export async function requireRole(allowed: Array<"ADMIN"|"CUSTOMER"|"CARRIER">) {
  const me = await getUserFromCookie();
  const ok = me && allowed.map(x => x.toUpperCase()).includes(String(me.role).toUpperCase());
  if (!ok) return { error: { status: 403, json: { error: "Forbidden" } } };
  return { me };
}

