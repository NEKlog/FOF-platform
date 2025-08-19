export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { z } from "zod";
import type { TaskStatus } from "@prisma/client";

const FINAL_STATUSES: readonly TaskStatus[] = ["DELIVERED", "CANCELLED"];
const isFinalStatus = (s: TaskStatus) => FINAL_STATUSES.includes(s);

const BidCreateSchema = z.object({
  taskId: z.number().int().positive(),
  amount: z.number().positive(),
  message: z.string().max(500).optional().nullable(),
});

export async function GET() {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "CARRIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bids = await prisma.bid.findMany({
    where: { carrierId: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, amount: true, message: true, status: true, createdAt: true,
      task: { select: { id: true, title: true, status: true, price: true, createdAt: true } }
    }
  });

  return NextResponse.json(bids);
}

export async function POST(req: Request) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "CARRIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = BidCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { taskId, amount, message } = parsed.data;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, status: true },
  });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (isFinalStatus(task.status)) {
    return NextResponse.json({ error: "Task is closed for bidding" }, { status: 409 });
  }

  const created = await prisma.bid.create({
    data: {
      taskId,
      carrierId: me.id,
      amount,
      message: message ?? null,
      status: "PENDING",
    },
    select: { id: true, taskId: true, carrierId: true, amount: true, message: true, status: true, createdAt: true },
  });

  return NextResponse.json(created, { status: 201 });
}
