export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

const ALLOWED = ["ADMIN","CUSTOMER","CARRIER"];

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const id = Number(params.id);
  const { role } = await req.json().catch(() => ({}));
  const nextRole = String(role || "").toUpperCase();
  if (!ALLOWED.includes(nextRole)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const user = await prisma.user.update({ where: { id }, data: { role: nextRole } });
  return NextResponse.json(user);
}
