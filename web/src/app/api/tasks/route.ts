export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true }
  });
  return NextResponse.json(tasks);
}
