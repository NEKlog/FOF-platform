export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.string().min(3), // fx "CARRIER" | "CUSTOMER"
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { email, password, role } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hash,
      role: role.toUpperCase(),
      approved: true, // sæt evtl. til false hvis admin skal godkende
      active: true,
    },
  });

  return NextResponse.json({ id: user.id, email: user.email, role: user.role });
}
