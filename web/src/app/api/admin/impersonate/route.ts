export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie, signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const userId = Number(body?.userId);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, approved: true, active: true },
  });
  if (!u) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const token = await signToken({
    sub: String(u.id),
    role: String(u.role).toUpperCase(),
    approved: !!u.approved,
    active: !!u.active,
  });
  await setAuthCookie(token);
  return NextResponse.json({ ok: true, as: u.role });
}
