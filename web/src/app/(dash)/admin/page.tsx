import { prisma } from "@/lib/db";
import { TaskStatus } from "@prisma/client";
import { getUserFromCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const me = await getUserFromCookie();

  const [totalTasks, carriersPending, statusCounts] = await Promise.all([
    prisma.task.count(),
    prisma.user.count({
      where: { approved: false, role: { in: ["carrier", "CARRIER"] } },
    }),
    prisma.task.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts: Record<TaskStatus, number> = {
    NEW: 0, PLANNED: 0, IN_PROGRESS: 0, DELIVERED: 0, CANCELLED: 0,
  };
  for (const row of statusCounts) counts[row.status] = row._count._all;

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-semibold">
        Velkommen{me ? `, ${me.email}` : ""}
      </h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card title="Opgaver i alt" value={totalTasks} href="/admin/kanban" />
        <Card title="Carriers afventer godkend." value={carriersPending} href="/admin/users?tab=carrier_pending" />
        <Card title="Ny"         value={counts.NEW}         href="/admin/kanban" />
        <Card title="Planlagt"   value={counts.PLANNED}     href="/admin/kanban" />
        <Card title="I gang"     value={counts.IN_PROGRESS} href="/admin/kanban" />
        <Card title="Leveret"    value={counts.DELIVERED}   href="/admin/kanban" />
        <Card title="Annulleret" value={counts.CANCELLED}   href="/admin/kanban" />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <BigLink title="Tildel opgaver →" href="/admin/assign" subtitle="Træk & slip til carriers" />
        <BigLink title="Administrér brugere →" href="/admin/users" subtitle="Godkend, roller, aktiv/inaktiv" />
      </div>
    </main>
  );
}

function Card({ title, value, href }: { title: string; value: number; href?: string }) {
  const content = (
    <div className="border rounded p-4 bg-white">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
  return href ? <a href={href}>{content}</a> : content;
}

function BigLink({ title, subtitle, href }: { title: string; subtitle?: string; href: string }) {
  return (
    <a href={href} className="border rounded p-6 bg-white block hover:bg-gray-50">
      <div className="text-lg font-medium">{title}</div>
      {subtitle && <div className="text-sm text-gray-500 mt-1">{subtitle}</div>}
    </a>
  );
}
