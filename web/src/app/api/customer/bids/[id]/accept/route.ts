export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import type { TaskStatus } from "@prisma/client";

const FINAL_STATUSES: readonly TaskStatus[] = ["DELIVERED", "CANCELLED"];
const isFinalStatus = (s: TaskStatus) => FINAL_STATUSES.includes(s);

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "CUSTOMER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bidId = Number(params.id);
  if (!Number.isFinite(bidId)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }

  const bid = await prisma.bid.findUnique({
    where: { id: bidId },
    select: {
      id: true, status: true, carrierId: true, taskId: true,
      task: { select: { id: true, status: true, customerId: true } }
    }
  });

  if (!bid) return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  if (!bid.task || bid.task.customerId !== me.id) {
    return NextResponse.json({ error: "Not your task" }, { status: 403 });
  }
  if (isFinalStatus(bid.task.status)) {
    return NextResponse.json({ error: "Task is closed" }, { status: 409 });
  }

  const result = await prisma.$transaction(async (tx) => {
    // Accept valgt bud
    const accepted = await tx.bid.update({
      where: { id: bidId },
      data: { status: "ACCEPTED" },
      select: { id: true, taskId: true, carrierId: true, status: true },
    });

    // Afvis alle andre bud på samme task
    await tx.bid.updateMany({
      where: { taskId: accepted.taskId, NOT: { id: accepted.id } },
      data: { status: "REJECTED" },
    });

    // Tilknyt carrier til task og sæt status til PLANNED (tilpas hvis I vil noget andet)
    const task = await tx.task.update({
      where: { id: accepted.taskId },
      data: { carrierId: accepted.carrierId, status: "PLANNED" },
      select: { id: true, status: true, carrierId: true },
    });

    return { accepted, task };
  });

  return NextResponse.json(result, { status: 200 });
}
