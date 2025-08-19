"use client";
import { useState } from "react";

export default function ImpersonateSwitcher() {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function impersonate() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: Number(id) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      const role = String(j.as || "").toUpperCase();
      if (role === "CARRIER") window.location.href = "/carrier";
      else if (role === "CUSTOMER") window.location.href = "/customer";
      else window.location.href = "/admin";
    } catch (e: any) {
      setErr(e?.message ?? "Fejl");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <div className="flex items-center gap-2">
      <input
        className="border rounded p-1 w-28"
        placeholder="User ID"
        value={id}
        onChange={e=>setId(e.target.value)}
        type="number"
      />
      <button disabled={!id || busy} onClick={impersonate} className="border rounded px-2 py-1 text-sm">
        {busy ? "Skifter…" : "Login som ID"}
      </button>
      <button onClick={logout} className="border rounded px-2 py-1 text-sm">Log ud</button>
      {err && <span className="text-red-600 text-xs ml-2">{err}</span>}
    </div>
  );
}
