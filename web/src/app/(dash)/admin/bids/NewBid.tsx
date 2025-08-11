"use client";

import { useEffect, useState, type FormEvent } from "react";

type TaskOpt = { id: number; title: string | null };
type CarrierOpt = { id: number; email: string | null };

const PRESETS = [500, 750, 1000, 1500];

export default function NewBid() {
  const [tasks, setTasks] = useState<TaskOpt[]>([]);
  const [carriers, setCarriers] = useState<CarrierOpt[]>([]);
  const [form, setForm] = useState({ taskId: "", carrierId: "", amount: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [tRes, cRes] = await Promise.all([fetch("/api/tasks"), fetch("/api/carrier")]);
      setTasks(await tRes.json());
      setCarriers(await cRes.json());
    })();
  }, []);

  function pickPreset(v: number) {
    setForm(f => ({ ...f, amount: String(v) }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const taskId = Number(form.taskId);
    const carrierId = Number(form.carrierId);
    const amount = Number(form.amount);

    if (!Number.isInteger(taskId) || taskId <= 0) return setError("Vælg en gyldig task");
    if (!Number.isInteger(carrierId) || carrierId <= 0) return setError("Vælg en gyldig carrier");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Amount skal være > 0");

    setLoading(true);
    try {
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, carrierId, amount, message: form.message || undefined })
      });
      if (!res.ok) {
        let details = "";
        try {
          const j = await res.json();
          details = typeof j?.error === "string" ? j.error : JSON.stringify(j?.error ?? {});
        } catch {}
        throw new Error(details || `HTTP ${res.status}`);
      }
      setForm({ taskId: "", carrierId: "", amount: "", message: "" });
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2 items-end">
      <select
        className="border rounded p-2 min-w-[240px]"
        value={form.taskId}
        onChange={(e) => setForm(f => ({ ...f, taskId: e.target.value }))}
      >
        <option value="">Vælg task…</option>
        {tasks.map(t => (
          <option key={t.id} value={t.id}>{t.id} — {t.title ?? "(uden titel)"}</option>
        ))}
      </select>

      <select
        className="border rounded p-2 min-w-[240px]"
        value={form.carrierId}
        onChange={(e) => setForm(f => ({ ...f, carrierId: e.target.value }))}
      >
        <option value="">Vælg carrier…</option>
        {carriers.map(c => (
          <option key={c.id} value={c.id}>{c.id} — {c.email ?? "(ingen email)"}</option>
        ))}
      </select>

      <div className="flex items-end gap-2">
        <input
          className="border rounded p-2 w-36"
          type="number"
          step="0.01"
          placeholder="amount"
          value={form.amount}
          onChange={(e) => setForm(f => ({ ...f, amount: e.target.value }))}
        />
        <div className="flex gap-1">
          {PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => pickPreset(p)}
              className={`border rounded px-2 py-1 text-sm ${form.amount === String(p) ? "bg-gray-200" : ""}`}
              title={`Brug ${p}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <input
        className="border rounded p-2"
        placeholder="message (optional)"
        value={form.message}
        onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
      />

      <button disabled={loading} className="border rounded px-3 py-2">
        {loading ? "Adding..." : "Add"}
      </button>

      {error && <div className="text-red-600 text-sm ml-2 max-w-[600px] break-all">{error}</div>}
    </form>
  );
}
