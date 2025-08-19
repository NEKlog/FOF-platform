export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { z } from "zod";
import { TaskStatus } from "@prisma/client";

const CreateTask = z.object({
  title: z.string().min(1),
  pickup: z.string().optional(),
  dropoff: z.string().optional(),
  price: z.number().positive().optional(),
  scheduledAt: z.string().datetime().optional(), // ISO
});

export async function GET() {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tasks = await prisma.task.findMany({
    where: { customerId: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, status: true, price: true, createdAt: true,
      pickup: true, dropoff: true, scheduledAt: true, carrierId: true,
      bids: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, amount: true, status: true, message: true, carrierId: true, createdAt: true,
          carrier: { select: { id: true, email: true } }
        }
      }
    }
  });

  return NextResponse.json(tasks);
}

export async function POST(req: Request) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = CreateTask.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { title, pickup, dropoff, price, scheduledAt } = parsed.data;

  const created = await prisma.task.create({
    data: {
      title,
      pickup, dropoff,
      price: price ?? null,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: TaskStatus.NEW,
      customerId: me.id,
    },
    select: { id: true, title: true, status: true, createdAt: true }
  });

  return NextResponse.json(created, { status: 201 });
}
