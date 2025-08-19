"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Bid = { id: number; amount: number; status: string; message?: string | null; carrierId: number; carrier?: { email: string } };
type Task = { id: number; title: string | null; status: string; price?: number | null; createdAt: string; bids: Bid[] };

export default function CustomerClient({ initial }: { initial: { tasks: Task[] } }) {
  const [tasks, setTasks] = useState<Task[]>(initial.tasks ?? []);
  const [title, setTitle] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [price, setPrice] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const res = await fetch("/api/customer/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          pickup: pickup.trim() || undefined,
          dropoff: dropoff.trim() || undefined,
          price: price ? Number(price) : undefined,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTitle(""); setPickup(""); setDropoff(""); setPrice("");
      // hent frisk
      const list = await fetch("/api/customer/tasks", { cache: "no-store" }).then(r => r.json());
      setTasks(list);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke oprette opgave");
    }
  }

  async function acceptBid(bidId: number) {
    setErr(null);
    try {
      const res = await fetch(`/api/customer/bids/${bidId}/accept`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const list = await fetch("/api/customer/tasks", { cache: "no-store" }).then(r => r.json());
      setTasks(list);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke acceptere bud");
    }
  }

  return (
    <section className="space-y-4">
      {err && <div className="text-red-600 break-all">{err}</div>}

      <form onSubmit={createTask} className="border rounded p-3 grid gap-2 md:grid-cols-5">
        <input className="border rounded p-2" placeholder="Titel" value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="border rounded p-2" placeholder="Afhentning" value={pickup} onChange={e=>setPickup(e.target.value)} />
        <input className="border rounded p-2" placeholder="Levering" value={dropoff} onChange={e=>setDropoff(e.target.value)} />
        <input className="border rounded p-2" placeholder="Pris (valgfri)" value={price} onChange={e=>setPrice(e.target.value)} />
        <button className="border rounded px-3 py-2">Opret</button>
      </form>

      <div className="space-y-3">
        {tasks.map(t => (
          <div key={t.id} className="border rounded p-3">
            <div className="font-medium">{t.title ?? `(Task #${t.id})`} <span className="text-xs text-gray-500">· {t.status}</span></div>
            <div className="text-xs text-gray-500">{new Date(t.createdAt).toLocaleString()}</div>
            <div className="mt-2 text-sm">Bud:</div>
            <div className="mt-1 flex flex-col gap-2">
              {t.bids.length === 0 ? (
                <div className="text-sm text-gray-500">Ingen bud endnu</div>
              ) : t.bids.map(b => (
                <div key={b.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{b.amount.toLocaleString()} kr</div>
                    <div className="text-xs text-gray-500">{b.carrier?.email ?? `Carrier #${b.carrierId}`} · {b.status}</div>
                    {b.message && <div className="text-xs mt-1">{b.message}</div>}
                  </div>
                  {b.status === "PENDING" && (
                    <button className="border rounded px-2 py-1" onClick={()=>acceptBid(b.id)}>Accepter</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
