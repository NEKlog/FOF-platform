"use client";

import { useMemo, useState } from "react";

type Carrier = { id: number; email: string };
type Task = {
  id: number;
  title: string | null;
  status: "NEW" | "PLANNED" | "IN_PROGRESS" | "DELIVERED" | "CANCELLED";
  carrierId: number | null;
  createdAt: string;
};

export default function AssignBoard({
  initial,
}: {
  initial: { carriers: Carrier[]; tasks: Task[] };
}) {
  const [tasks, setTasks] = useState<Task[]>(initial.tasks ?? []);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const carriers = useMemo(() => initial.carriers ?? [], [initial.carriers]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return tasks;
    return tasks.filter(
      (t) =>
        (t.title ?? "").toLowerCase().includes(s) ||
        String(t.id).includes(s)
    );
  }, [q, tasks]);

  const columns = useMemo(() => {
    return [
      { key: "unassigned" as const, title: "Unassigned", carrierId: null as number | null },
      ...carriers.map((c) => ({
        key: `carrier-${c.id}` as const,
        title: c.email,
        carrierId: c.id as number | null,
      })),
    ];
  }, [carriers]);

  const byColumn = useMemo(() => {
    const map = new Map<number | null, Task[]>();
    for (const col of columns) map.set(col.carrierId, []);
    for (const t of filtered) {
      const k = t.carrierId ?? null;
      (map.get(k) ?? []).push(t);
    }
    return map;
  }, [filtered, columns]);

  async function assign(taskId: number, carrierId: number | null) {
    setErr(null);
    setBusyId(taskId);

    const prev = tasks;
    setTasks(tasks.map(t => (t.id === taskId ? { ...t, carrierId } : t)));

    try {
      const res = await fetch(`/api/admin/task-assign/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ carrierId }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`PATCH ${res.status}: ${txt}`);
      }
    } catch (e: any) {
      setTasks(prev); // rollback
      setErr(e?.message ?? "Kunne ikke tildele opgave");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-3">
      {err && <div className="text-red-600 break-all">{err}</div>}

      <div className="flex gap-2">
        <input
          className="border rounded p-2 flex-1"
          placeholder="Søg efter titel eller #id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-4 lg:grid-cols-5 gap-3">
        {columns.map((col) => (
          <AssignColumn
            key={String(col.key)}
            title={col.title}
            carrierId={col.carrierId}
            tasks={byColumn.get(col.carrierId) ?? []}
            onDrop={(taskId) => assign(taskId, col.carrierId)}
            busyId={busyId}
          />
        ))}
      </div>
    </section>
  );
}

function AssignColumn({
  title,
  carrierId,
  tasks,
  onDrop,
  busyId,
}: {
  title: string;
  carrierId: number | null;
  tasks: Task[];
  onDrop: (taskId: number) => void;
  busyId: number | null;
}) {
  function allowDrop(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isFinite(id)) onDrop(id);
  }
  return (
    <div
      className="border rounded min-h-72 p-2 bg-white/70"
      onDragOver={allowDrop}
      onDrop={handleDrop}
    >
      <div className="font-semibold mb-2">
        {title}
        <span className="text-xs text-gray-500 ml-2">({tasks.length})</span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} busy={busyId === t.id} />
        ))}
        {tasks.length === 0 && <div className="text-sm text-gray-500">Ingen</div>}
      </div>
    </div>
  );
}

function TaskCard({ task, busy }: { task: Task; busy: boolean }) {
  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData("text/plain", String(task.id));
  }
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`border rounded p-2 cursor-move bg-white ${busy ? "opacity-50" : ""}`}
      title={`ID: ${task.id}`}
    >
      <div className="font-medium">{task.title ?? `(Task #${task.id})`}</div>
      <div className="text-xs text-gray-500 mt-1">
        {new Date(task.createdAt).toLocaleString()}
      </div>
    </div>
  );
}
