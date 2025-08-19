import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { redirect } from "next/navigation";
import RelationsEditor from "./AdminTaskEditor.client";

export default async function Page({ params }: { params: { id: string } }) {
  const me = await getUserFromCookie();
  if (!me || String(me.role).toUpperCase() !== "ADMIN") redirect("/login");

  const id = Number(params.id);
  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true, title: true, status: true, price: true,
      customer: { select: { id: true, email: true, role: true, approved: true, active: true } },
      carrier:  { select: { id: true, email: true, role: true, approved: true, active: true } },
    },
  });
  if (!task) redirect("/(dash)/admin/tasks");

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Opgave #{task.id}</h1>
      <RelationsEditor
        taskId={task.id}
        initialCustomer={task.customer ?? null}
        initialCarrier={task.carrier ?? null}
      />
    </div>
  );
}
