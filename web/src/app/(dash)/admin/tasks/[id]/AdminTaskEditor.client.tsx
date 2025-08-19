"use client";
import { useState } from "react";
import UserPicker from "@/components/admin/UserPicker";

type UserHit = { id: number; email: string; role: string; approved: boolean; active: boolean };

export default function RelationsEditor({
  taskId,
  initialCustomer,
  initialCarrier,
}: {
  taskId: number;
  initialCustomer: UserHit | null;
  initialCarrier: UserHit | null;
}) {
  const [customer, setCustomer] = useState<UserHit|null>(initialCustomer);
  const [carrier, setCarrier]   = useState<UserHit|null>(initialCarrier);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function saveAssignments() {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customer ? customer.id : null,
          carrierId: carrier ? carrier.id : null,
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      setMsg("Gemt ✔");
    } catch (e:any) {
      setMsg(`Fejl: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 border rounded p-3">
      <div className="font-medium">Relationer & tildeling</div>

      <UserPicker
        role="CUSTOMER"
        value={customer}
        onChange={setCustomer}
        label="Kunde"
        placeholder="Søg kunde (email)…"
      />

      <UserPicker
        role="CARRIER"
        value={carrier}
        onChange={setCarrier}
        label="Carrier"
        placeholder="Søg carrier (email)…"
      />

      <div className="flex gap-2">
        <button className="btn" onClick={saveAssignments} disabled={saving}>Gem</button>
        {msg && <div className="text-sm text-gray-600">{msg}</div>}
      </div>
    </div>
  );
}
