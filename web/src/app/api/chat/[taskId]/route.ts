import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { z } from "zod";

export async function GET(_req: Request, ctx: { params: { taskId: string } }) {
  const me = await getUserFromCookie();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const taskId = Number(ctx.params.taskId);

  // simpel adgang: deltager hvis admin eller (customerId/carrierId matcher)
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { customerId: true, carrierId: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const role = String(me.role).toUpperCase();
  const isParticipant = role === "ADMIN" || me.id === task.customerId || me.id === task.carrierId;
  if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const messages = await prisma.message.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    take: 200
  });
  return NextResponse.json(messages);
}

const Body = z.object({
  toId: z.number().int().positive(),
  body: z.string().min(1).max(2000),
});
export async function POST(req: Request, ctx: { params: { taskId: string } }) {
  const me = await getUserFromCookie();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const taskId = Number(ctx.params.taskId);

  const parsed = Body.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const created = await prisma.message.create({
    data: { taskId, fromId: me.id, toId: parsed.data.toId, body: parsed.data.body }
  });
  return NextResponse.json(created, { status: 201 });
}
