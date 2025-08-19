export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcrypt";

const EMAIL = "admin@foftilbud.dk";
const PASSWORD = "Admin123!"; // skift efter login
const ROLE = "ADMIN";

export async function GET() {
  // Ekstra sikkerhed: kun i udvikling
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disabled in production" }, { status: 403 });
  }

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  const hash = await bcrypt.hash(PASSWORD, 10);

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { password: hash, role: ROLE, approved: true, active: true },
      select: { id: true, email: true, role: true, approved: true, active: true },
    });
    return NextResponse.json({ ok: true, mode: "updated", user: updated });
  }

  const created = await prisma.user.create({
    data: {
      email: EMAIL,
      password: hash,
      role: ROLE,
      approved: true,
      active: true,
    },
    select: { id: true, email: true, role: true, approved: true, active: true },
  });

  return NextResponse.json({ ok: true, mode: "created", user: created });
}
