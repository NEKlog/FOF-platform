export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// GET /api/carrier?q=mail&limit=50
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const n = Number(searchParams.get("limit") ?? 50);
  const take = Number.isFinite(n) ? Math.min(Math.max(n, 1), 200) : 50;

  // SQLite: ingen mode:"insensitive"
  const where: Prisma.UserWhereInput = {
    OR: [{ role: "CARRIER" }, { role: "carrier" }, { role: "Carrier" }],
    ...(q ? { email: { contains: q } } : {})
  };

  const carriers = await prisma.user.findMany({
    where,
    orderBy: { id: "desc" },
    take,
    select: { id: true, email: true, role: true }
  });

  return NextResponse.json(carriers);
}
