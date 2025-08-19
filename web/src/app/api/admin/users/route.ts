// web/src/app/api/admin/users/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/hash";

/* -------------------- Create (POST) -------------------- */

const CreateSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN","CUSTOMER","CARRIER"]),
  password: z.string().min(8).optional(), // valgfrit: admin kan sætte pw direkte
});

export async function POST(req: Request) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, role, password } = parsed.data;

  const exist = await prisma.user.findUnique({ where: { email } });
  if (exist) return NextResponse.json({ error: "Email findes allerede" }, { status: 409 });

  // Hvis admin angiver password -> opret med det
  if (password) {
    const user = await prisma.user.create({
      data: {
        email,
        role,
        password: await hashPassword(password),
        approved: true,
        active: true,
      },
      select: { id: true, email: true, role: true, approved: true, active: true },
    });
    return NextResponse.json({ user, inviteUrl: null }, { status: 201 });
  }

  // Ellers: opret bruger + invite-token (brugeren vælger selv password via link)
  const user = await prisma.user.create({
    data: { email, role, password: "", approved: true, active: true },
    select: { id: true, email: true, role: true, approved: true, active: true },
  });

  const raw = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 timer

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const base =
    process.env.NEXT_PUBLIC_BASE_URL ||
    new URL(req.url).origin;

  const inviteUrl = `${base}/reset?token=${raw}`;

  return NextResponse.json({ user, inviteUrl }, { status: 201 });
}

/* -------------------- Search (GET) -------------------- */
/**
 * Query params:
 *  - q: substring match på email (min 2 tegn anbefales)
 *  - role: CUSTOMER | CARRIER | ADMIN (valgfrit filter)
 *  - page, pageSize (valgfri pagination; default 1/20)
 *
 * Returnerer { items, total, page, pageSize }.
 * UserPicker bruger kun 'items', men resten er nyttigt i admin UI.
 */
export async function GET(req: Request) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const roleParam = (searchParams.get("role") ?? "").toUpperCase();
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const where: any = {};
  if (q) where.email = { contains: q, mode: "insensitive" };
  if (["ADMIN","CUSTOMER","CARRIER"].includes(roleParam)) where.role = roleParam;

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, email: true, role: true, approved: true, active: true },
    }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}
