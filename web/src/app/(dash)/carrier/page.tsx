import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import CarrierClient from "./carrier.client";

export default async function CarrierPage() {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "CARRIER") {
    redirect("/login?m=forbidden");
  }

  const [tasksRaw, bidsRaw] = await Promise.all([
    prisma.task.findMany({
      where: { carrierId: me.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, status: true, price: true, createdAt: true }
    }),
    prisma.bid.findMany({
      where: { carrierId: me.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, amount: true, status: true, message: true, createdAt: true,
        task: { select: { id: true, title: true, status: true } }
      }
    })
  ]);

  const tasks = tasksRaw.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));

  const bids = bidsRaw.map(b => ({
    ...b,
    createdAt: b.createdAt.toISOString(),
  }));

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Carrier dashboard</h1>
      <CarrierClient initial={{ tasks, bids }} />
    </main>
  );
}
