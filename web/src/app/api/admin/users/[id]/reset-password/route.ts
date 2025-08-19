export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number(params.id);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Invalider evt. aktive tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() },
  });

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({ data: { userId: id, tokenHash, expiresAt } });

  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetUrl = `${origin}/reset?token=${raw}`;

  return NextResponse.json({ resetUrl });
}
