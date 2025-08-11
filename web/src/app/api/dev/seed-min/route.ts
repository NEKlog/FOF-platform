export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST() {
  // lav en carrier hvis ingen findes
  const carrier =
    (await prisma.user.findFirst({ where: { role: "CARRIER" } })) ??
    (await prisma.user.create({
      data: {
        email: `carrier_${Date.now()}@test.local`,
        password: "hashed", // placeholder
        role: "CARRIER",
        approved: true,
        active: true
      }
    }));

  // lav en task hvis ingen findes
  const task =
    (await prisma.task.findFirst()) ??
    (await prisma.task.create({
      data: {
        title: "Test task",
        status: "NEW",
        paid: false
      }
    }));

  return NextResponse.json({ carrierId: carrier.id, taskId: task.id });
}
