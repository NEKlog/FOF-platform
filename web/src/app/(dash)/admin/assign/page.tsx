import { prisma } from "@/lib/db";
import AssignBoard from "./AssignBoard";

export const dynamic = "force-dynamic";

export default async function AdminAssignPage() {
  const [carriers, rawTasks] = await Promise.all([
    prisma.user.findMany({
      where: {
        approved: true,
        active: true,
        OR: [{ role: "carrier" }, { role: "CARRIER" }],
      },
      select: { id: true, email: true },
      orderBy: { email: "asc" },
    }),
    prisma.task.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        carrierId: true,
        createdAt: true, // <-- Date fra Prisma
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  // 👇 Serialisér Date -> string som AssignBoard forventer
  const tasks = rawTasks.map(t => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Tildel opgaver til carriers</h1>
      <AssignBoard initial={{ carriers, tasks }} />
    </main>
  );
}
