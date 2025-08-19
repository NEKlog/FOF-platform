export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email + password påkrævet" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, approved: true, active: true, password: true },
  });
  if (!user) return NextResponse.json({ error: "Forkert login" }, { status: 401 });
  if (!user.active) return NextResponse.json({ error: "Konto deaktiveret" }, { status: 403 });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return NextResponse.json({ error: "Forkert login" }, { status: 401 });

  // (valgfrit) kræv godkendt:
  if (!user.approved && user.role === "CUSTOMER") {
    return NextResponse.json({ error: "Konto afventer godkendelse" }, { status: 403 });
  }

  const token = await signToken({
    sub: String(user.id),
    role: user.role,
    approved: user.approved,
    active: user.active,
  });

  await setAuthCookie(token);

  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, role: user.role, approved: user.approved, active: user.active },
  });
}
