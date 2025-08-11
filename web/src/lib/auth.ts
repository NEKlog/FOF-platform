import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import { prisma } from "@/lib/db";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
const COOKIE_NAME = "auth";

type TokenPayload = {
  sub: string;               // userId (string for JWT, men vi kan caste)
  role: string;              // ADMIN | CARRIER | CUSTOMER | ...
  approved: boolean;
  active: boolean;
} & JWTPayload;

export async function signToken(payload: Omit<TokenPayload, "iat" | "exp">) {
  const days = Number(process.env.JWT_EXPIRES_DAYS ?? "7");
  const exp = Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify<TokenPayload>(token, SECRET);
    return payload;
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const c = await cookies();
  c.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function clearAuthCookie() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}

export async function getUserFromCookie() {
  const c = await cookies();
  const token = c.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, approved: true, active: true }
  });
  return user;
}
