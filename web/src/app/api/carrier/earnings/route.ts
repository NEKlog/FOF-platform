import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "CARRIER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [sumEarned, tasks] = await Promise.all([
    prisma.transaction.aggregate({
      where: { carrierId: me.id, type: "CARRIER_EARNED" },
      _sum: { amount: true },
    }),
    prisma.task.findMany({
      where: { carrierId: me.id },
      select: { id: true, title: true, status: true, price: true, commissionPct: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 100
    }),
  ]);

  return NextResponse.json({
    totalEarnedDkk: (sumEarned._sum.amount ?? 0) / 100,
    tasks,
  });
}
