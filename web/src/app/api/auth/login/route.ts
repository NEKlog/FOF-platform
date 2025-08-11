export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { setAuthCookie, signToken } from "@/lib/auth";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  // hvis jeres passwords allerede er hashed (bcrypt):
  const ok = await bcrypt.compare(password, user.password).catch(() => false);
  // hvis I har klartekst i dev, kan I midlertidigt bruge: const ok = password === user.password;

  if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

  const token = await signToken({
    sub: String(user.id),
    role: String(user.role || "").toUpperCase(),
    approved: !!user.approved,
    active: !!user.active,
  });

  await setAuthCookie(token);
  return NextResponse.json({ ok: true });
}
