"use client";

import { useMemo, useState } from "react";

type Status = "NEW" | "PLANNED" | "IN_PROGRESS" | "DELIVERED" | "CANCELLED";
type Task = { id: number; title: string | null; status: Status; paid: boolean; createdAt: string };

const COLUMNS: { key: Status; title: string }[] = [
  { key: "NEW", title: "Ny" },
  { key: "PLANNED", title: "Planlagt" },
  { key: "IN_PROGRESS", title: "I gang" },
  { key: "DELIVERED", title: "Leveret" },
  { key: "CANCELLED", title: "Annulleret" },
];

export default function KanbanClient({ initial }: { initial: { items: Task[] } }) {
  const [items, setItems] = useState<Task[]>(initial.items ?? []);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [busyTask, setBusyTask] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const map: Record<Status, Task[]> = { NEW: [], PLANNED: [], IN_PROGRESS: [], DELIVERED: [], CANCELLED: [] };
    for (const t of items) map[t.status]?.push(t);
    return map;
  }, [items]);

  async function refresh() {
    const res = await fetch(`/api/admin/tasks?page=1&pageSize=200`, { cache: "no-store" });
    const data = await res.json();
    setItems(data.items ?? []);
  }

  async function addQuick(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setAdding(true); setErr(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle("");
      await refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke oprette opgave");
    } finally {
      setAdding(false);
    }
  }

 async function moveTask(taskId: number, newStatus: Status) {
  setErr(null);
  const task = items.find(t => t.id === taskId);
  if (!task || task.status === newStatus) return;

  const prev = items;
  setBusyTask(taskId);                              // <-- viser loading på kortet
  setItems(items.map(t => (t.id === taskId ? { ...t, status: newStatus } : t)));

  try {
      const res = await fetch("/api/admin/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`PATCH ${res.status}: ${txt}`);
    }
  } catch (e: any) {
    setItems(prev);                                 // rollback
    setErr(e?.message ?? "Kunne ikke opdatere status");
  } finally {
    setBusyTask(null);                              // <-- fjern loading
  }
}




  return (
    <section className="space-y-4">
      {err && <div className="text-red-600 break-all">{err}</div>}

      <form onSubmit={addQuick} className="border rounded p-3 flex gap-2">
        <input className="border rounded p-2 flex-1" placeholder="Ny opgave" value={title} onChange={e=>setTitle(e.target.value)} />
        <button className="border rounded px-3 py-2" disabled={adding}>{adding ? "Opretter…" : "Opret"}</button>
      </form>

      <div className="grid md:grid-cols-5 gap-3">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.key}
            title={col.title}
            statusKey={col.key}
            tasks={byStatus[col.key]}
            onDropTask={moveTask}
            busyTask={busyTask}
          />
        ))}
      </div>
    </section>
  );
}

function KanbanColumn({ title, statusKey, tasks, onDropTask, busyTask }: {
  title: string; statusKey: Status; tasks: Task[];
  onDropTask: (taskId: number, status: Status) => void; busyTask: number | null;
}) {
  function allowDrop(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const id = Number(e.dataTransfer.getData("text/plain"));
    if (Number.isFinite(id)) onDropTask(id, statusKey);
  }
  return (
    <div className="border rounded min-h-72 p-2 bg-white/70" onDragOver={allowDrop} onDrop={onDrop}>
      <div className="font-semibold mb-2">{title}</div>
      <div className="flex flex-col gap-2">
        {tasks.map(t => <TaskCard key={t.id} task={t} busy={busyTask === t.id} />)}
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
        {new Date(task.createdAt).toLocaleString()} {task.paid ? "· betalt" : ""}
      </div>
    </div>
  );
}
