export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/hash";

const Schema = z.object({ password: z.string().min(8) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = Number(params.id);

  const body = await req.json().catch(() => ({}));
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const user = await prisma.user.update({
    where: { id },
    data: { password: await hashPassword(parsed.data.password) }
  });

  // invalider aktive reset-tokens
  await prisma.passwordResetToken.updateMany({
    where: { userId: id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { expiresAt: new Date() }
  });

  return NextResponse.json({ ok: true, id: user.id });
}
