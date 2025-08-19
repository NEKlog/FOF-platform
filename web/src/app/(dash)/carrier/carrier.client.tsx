"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Task = { id: number; title: string | null; status: string; price?: number | null; createdAt: string };
type BidRow = { id: number; amount: number; status: string; message?: string | null; createdAt: string; task: { id: number; title: string | null; status: string } };

export default function CarrierClient({ initial }: { initial: { tasks: Task[]; bids: BidRow[] } }) {
  const [tab, setTab] = useState<"assigned"|"mybids"|"newbid">("assigned");
  const [tasks, setTasks] = useState<Task[]>(initial.tasks ?? []);
  const [bids, setBids] = useState<BidRow[]>(initial.bids ?? []);
  const [taskId, setTaskId] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function refresh() {
    const [t, b] = await Promise.all([
      fetch("/api/carrier/tasks", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/carrier/bids", { cache: "no-store" }).then(r => r.json()),
    ]);
    setTasks(t); setBids(b); router.refresh();
  }

  async function submitBid(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await fetch("/api/carrier/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: Number(taskId),
          amount: Number(amount),
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTaskId(""); setAmount(""); setMessage("");
      await refresh();
      setTab("mybids");
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke afgive bud");
    }
  }

  return (
    <section className="space-y-4">
      {err && <div className="text-red-600 break-all">{err}</div>}

      <div className="flex gap-2">
        <button className={`border rounded px-3 py-1 ${tab==="assigned"?"bg-gray-100":""}`} onClick={()=>setTab("assigned")}>Tildelte opgaver</button>
        <button className={`border rounded px-3 py-1 ${tab==="mybids"?"bg-gray-100":""}`} onClick={()=>setTab("mybids")}>Mine bud</button>
        <button className={`border rounded px-3 py-1 ${tab==="newbid"?"bg-gray-100":""}`} onClick={()=>setTab("newbid")}>Afgiv bud (ID)</button>
      </div>

      {tab === "assigned" && (
        <div className="grid gap-2">
          {tasks.map(t => (
            <div key={t.id} className="border rounded p-2">
              <div className="font-medium">{t.title ?? `(Task #${t.id})`} <span className="text-xs text-gray-500">· {t.status}</span></div>
              <div className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {tasks.length === 0 && <div className="text-sm text-gray-500">Ingen tildelte opgaver</div>}
        </div>
      )}

      {tab === "mybids" && (
        <div className="grid gap-2">
          {bids.map(b => (
            <div key={b.id} className="border rounded p-2 flex items-center justify-between">
              <div>
                <div className="font-medium">{b.amount.toLocaleString()} kr · {b.status}</div>
                <div className="text-xs text-gray-500">Task #{b.task.id} · {b.task.title ?? "(ingen titel)"} · {b.task.status}</div>
                {b.message && <div className="text-xs mt-1">{b.message}</div>}
              </div>
            </div>
          ))}
          {bids.length === 0 && <div className="text-sm text-gray-500">Ingen bud endnu</div>}
        </div>
      )}

      {tab === "newbid" && (
        <form onSubmit={submitBid} className="border rounded p-3 grid gap-2 md:grid-cols-4">
          <input className="border rounded p-2" placeholder="Task ID" value={taskId} onChange={e=>setTaskId(e.target.value)} />
          <input className="border rounded p-2" placeholder="Beløb (kr)" value={amount} onChange={e=>setAmount(e.target.value)} />
          <input className="border rounded p-2" placeholder="Besked (valgfri)" value={message} onChange={e=>setMessage(e.target.value)} />
          <button className="border rounded px-3 py-2">Afgiv bud</button>
        </form>
      )}
    </section>
  );
}
