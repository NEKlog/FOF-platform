export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { z } from "zod";
import { TaskStatus } from "@prisma/client";

const CreateTaskSchema = z.object({
  title: z.string().min(1),
  price: z.number().positive().optional(),
  pickup: z.string().max(500).optional(),
  dropoff: z.string().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
  customerId: z.number().int().positive().optional(), // admin kan (valgfrit) tilknytte kunde
  carrierId: z.number().int().positive().optional(),  // admin kan (valgfrit) tilknytte carrier
  status: z.nativeEnum(TaskStatus).optional(),        // valgfri status ved oprettelse
});

// GET: liste tasks (med filtre)
export async function GET(req: Request) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const status = searchParams.get("status") as TaskStatus | null;
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));

  const where: any = {};
  if (q) where.title = { contains: q };
  if (status && Object.values(TaskStatus).includes(status)) where.status = status;

  const [total, items] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        status: true,
        paid: true,
        price: true,
        pickup: true,
        dropoff: true,
        scheduledAt: true,
        customerId: true,
        carrierId: true,
        createdAt: true,
        bids: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            amount: true,
            status: true,
            message: true,
            carrierId: true,
            createdAt: true,
            carrier: { select: { id: true, email: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({ total, items, page, pageSize });
}

// POST: opret task (admin)
export async function POST(req: Request) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, price, pickup, dropoff, scheduledAt, customerId, carrierId, status } = parsed.data;

  const created = await prisma.task.create({
    data: {
      title,
      price: price ?? null,
      pickup: pickup ?? null,
      dropoff: dropoff ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      customerId: customerId ?? null,
      carrierId: carrierId ?? null,
      status: status ?? "NEW",
    },
    select: {
      id: true, title: true, status: true, price: true, pickup: true, dropoff: true, scheduledAt: true,
      customerId: true, carrierId: true, createdAt: true, paid: true,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
