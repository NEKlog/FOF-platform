import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";

export async function GET() {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [totals, byCarrier] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["carrierId"],
      _sum: { amount: true },
    })
  ]);

  return NextResponse.json({ totals, byCarrier });
}
