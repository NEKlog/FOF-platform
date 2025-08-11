export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { Prisma, TaskStatus } from "@prisma/client";

// ------- GET (liste) -------
export async function GET() {
  const bids = await prisma.bid.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      task: { select: { id: true, title: true } },
      carrier: { select: { id: true, email: true } }
    }
  });
  return NextResponse.json(bids);
}

// ------- POST (opret) -------
const Input = z.object({
  taskId: z.coerce.number().int().positive(),
  carrierId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  message: z.string().optional()
});

export async function POST(req: Request) {
  try {
    const data = Input.parse(await req.json());

    const [task, carrier] = await Promise.all([
      prisma.task.findUnique({ where: { id: data.taskId }, select: { id: true, status: true, paid: true } }),
      prisma.user.findUnique({ where: { id: data.carrierId }, select: { id: true } })
    ]);

    if (!task)    return NextResponse.json({ error: "Task not found" }, { status: 400 });
    if (!carrier) return NextResponse.json({ error: "Carrier not found" }, { status: 400 });

    if (task.status === TaskStatus.DELIVERED)
      return NextResponse.json({ error: "Bidding er lukket: Task er allerede leveret." }, { status: 409 });
    if (task.status === TaskStatus.CANCELLED)
      return NextResponse.json({ error: "Bidding er lukket: Task er annulleret." }, { status: 409 });
    if (task.paid)
      return NextResponse.json({ error: "Bidding er lukket: Task er allerede betalt." }, { status: 409 });

    const created = await prisma.bid.create({
      data: {
        taskId: data.taskId,
        carrierId: data.carrierId,
        amount: data.amount,
        message: data.message
      }
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError)
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003")
      return NextResponse.json({ error: "Foreign key: taskId eller carrierId findes ikke." }, { status: 400 });
    console.error(err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

