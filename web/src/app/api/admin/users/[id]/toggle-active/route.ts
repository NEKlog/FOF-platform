export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = Number(params.id);
  const curr = await prisma.user.findUnique({ where: { id }, select: { active: true } });
  if (!curr) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await prisma.user.update({ where: { id }, data: { active: !curr.active } });
  return NextResponse.json(user);
}
