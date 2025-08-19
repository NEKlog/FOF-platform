export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { z } from "zod";

const Body = z.object({
  status: z.enum(["NEW", "PLANNED", "IN_PROGRESS", "DELIVERED", "CANCELLED"]),
});

// Ping-GET så du kan teste ruten findes (skal give 200 JSON)
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  return NextResponse.json({ ok: true, where: "api/admin/task-status/[id]", id: Number(ctx.params.id) || null });
}

export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Bad task id" }, { status: 400 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // ---- Guard mod ulovlige skift / no-op
  const current = await prisma.task.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const next = parsed.data.status;
  if (current.status === next) {
    return NextResponse.json({ error: "No-op (same status)" }, { status: 400 });
  }

  const allowed: Record<string, string[]> = {
    NEW: ["PLANNED", "CANCELLED"],
    PLANNED: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["DELIVERED", "CANCELLED"],
    DELIVERED: [],    // låst
    CANCELLED: [],    // låst
  };
  if (!allowed[current.status]?.includes(next)) {
    return NextResponse.json(
      { error: `Illegal transition ${current.status} → ${next}` },
      { status: 400 }
    );
  }
  // ----

  try {
    const updated = await prisma.task.update({
      where: { id },
      data: { status: next },
      select: { id: true, status: true, paid: true },
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed" }, { status: 500 });
  }
}


