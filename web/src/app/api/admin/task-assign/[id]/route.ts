export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { z } from "zod";

const Body = z.object({ carrierId: z.number().int().positive().nullable() });

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Bad task id" }, { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { carrierId } = parsed.data;

  if (carrierId) {
    const c = await prisma.user.findUnique({
      where: { id: carrierId },
      select: { role: true, approved: true, active: true },
    });
    if (!c || String(c.role).toUpperCase() !== "CARRIER" || !c.approved || !c.active) {
      return NextResponse.json({ error: "Invalid carrier" }, { status: 400 });
    }
  }

  const updated = await prisma.task.update({
    where: { id },
    data: { carrierId: carrierId ?? null },
    select: { id: true, title: true, status: true, carrierId: true },
  });

  return NextResponse.json(updated);
}
