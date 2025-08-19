
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: number; email: string; role: string; approved: boolean; active: boolean; createdAt: string };

export default function AdminUsersClient({ initial }: { initial: { roles: string[]; users: User[] } }) {
  const [menu] = useState<"approve" | "tasks" | "commission">("approve"); // vi viser kun "approve"-delen her
  const [userTab, setUserTab] = useState<"all"|"admin"|"customer"|"carrier"|"carrier_pending">("all");
  const [status, setStatus] = useState<""|"active"|"inactive"|"approved"|"pending">("");
  const [q, setQ] = useState("");
  const [roles] = useState<string[]>(initial.roles ?? ["ADMIN","CUSTOMER","CARRIER"]);
  const [users, setUsers] = useState<User[]>(initial.users ?? []);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");
  const router = useRouter();


  async function fetchUsers() {
    setLoading(true); setErr("");
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (userTab === "admin") params.set("role","ADMIN");
    if (userTab === "customer") params.set("role","CUSTOMER");
    if (userTab === "carrier") params.set("role","CARRIER");
    if (status === "active") params.set("active","true");
    if (status === "inactive") params.set("active","false");
    if (status === "approved") params.set("approved","true");
    if (status === "pending") params.set("approved","false");

    const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) { setErr("Kunne ikke hente brugere"); setLoading(false); return; }
    setUsers(await res.json());
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); /* on mount */ }, []);
  useEffect(() => { fetchUsers(); }, [userTab, status]); // skift tab/status

  const displayed = useMemo(() => {
    const base = userTab === "carrier_pending"
      ? users.filter(u => u.role.toUpperCase() === "CARRIER" && !u.approved)
      : users;
    if (!q.trim()) return base;
    return base.filter(u => u.email?.toLowerCase().includes(q.toLowerCase()));
  }, [users, q, userTab]);

  async function post(url: string, body?: any) {
    const res = await fetch(url, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(await res.text());
    await fetchUsers(); // <- opdater listen direkte
    // alternativt/ekstra: router.refresh(); // hvis du også vil re-hente serverkomponenten
  }


  async function approveUser(id: number) {
    await post(`/api/admin/users/${id}/approve`);
    router.refresh();
  }

  async function blockUser(id: number) {
    await post(`/api/admin/users/${id}/block`);
    router.refresh();
  }

  async function toggleActive(id: number) {
    await post(`/api/admin/users/${id}/toggle-active`);
    router.refresh();
  }

  async function changeRole(id: number, role: string) {
    await post(`/api/admin/users/${id}/role`, { role });
    router.refresh();
  }

  async function createUser(email: string, role: string, password?: string) {
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, password }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j?.error || "Fejl");
    // j.inviteUrl kan vises/kopieres
    await fetchUsers();
  }

  function CreateUserForm({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN"|"CUSTOMER"|"CARRIER">("CUSTOMER");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          role,
          password: password.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error ? JSON.stringify(j.error) : `HTTP ${res.status}`);
      if (j.inviteUrl) setMsg(`Invite-link: ${j.inviteUrl}`);
      else setMsg(`Bruger oprettet med password.`);
      setEmail(""); setPassword("");
      await onCreated();
    } catch (e: any) {
      setErr(e?.message || "Kunne ikke oprette bruger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="border rounded p-3 flex flex-wrap gap-2 items-end">
      <div>
        <label className="text-sm">Email</label>
        <input className="border rounded p-2 block" value={email} onChange={e=>setEmail(e.target.value)} placeholder="user@domain.com" />
      </div>
      <div>
        <label className="text-sm">Rolle</label>
        <select className="border rounded p-2 block" value={role} onChange={e=>setRole(e.target.value as any)}>
          <option value="ADMIN">ADMIN</option>
          <option value="CUSTOMER">CUSTOMER</option>
          <option value="CARRIER">CARRIER</option>
        </select>
      </div>
      <div>
        <label className="text-sm">Password (valgfrit)</label>
        <input className="border rounded p-2 block" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="min. 8 tegn, ellers invite" />
      </div>
      <button className="border rounded px-3 py-2" disabled={busy}>{busy ? "Opretter…" : "Opret bruger"}</button>
      {msg && <div className="text-sm text-green-700 ml-2 break-all">{msg}</div>}
      {err && <div className="text-sm text-red-600 ml-2 break-all">{err}</div>}
    </form>
  );
}



  return (
    <section className="space-y-4">
      {/* NY: Opret bruger */}
      <CreateUserForm onCreated={fetchUsers} />

      {/* filtre */}
      <div className="border rounded p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-sm">Søg (email)</label>
          <input className="border rounded p-2 block" placeholder="fx user@domain.com" value={q} onChange={e=>setQ(e.target.value)} />
        </div>
        <div>
          <label className="text-sm">Status</label>
          <select className="border rounded p-2 block" value={status} onChange={e=>setStatus(e.target.value as any)}>
            <option value="">Alle</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Deaktiveret</option>
            <option value="approved">Godkendt</option>
            <option value="pending">Afventer</option>
          </select>
        </div>
        <button className="border rounded px-3 py-2 ml-auto" onClick={fetchUsers}>Opdater</button>
      </div>

      {/* tabs */}
      <div className="flex gap-2">
        {[
          ["all","Alle"],
          ["admin","Admin"],
          ["customer","Customer"],
          ["carrier","Carrier"],
          ["carrier_pending","Carrier (afventer)"]
        ].map(([k,label]) => (
          <button
            key={k}
            className={`border rounded px-3 py-1 ${userTab===k ? "bg-gray-100" : ""}`}
            onClick={()=>setUserTab(k as any)}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div>Indlæser…</div>}
      {err && <div className="text-red-600">{err}</div>}

      {/* liste */}
      <div className="border rounded">
        <div className="grid grid-cols-5 gap-2 px-3 py-2 border-b text-sm font-medium">
          <div>Email</div>
          <div>Oprettet</div>
          <div>Status</div>
          <div>Rolle</div>
          <div className="text-right">Handling</div>
        </div>
        <div className="divide-y">
          {displayed.length === 0 ? (
            <div className="p-3 text-gray-500 text-sm">Ingen brugere fundet.</div>
          ) : displayed.map(u => (
            <div key={u.id} className="grid grid-cols-5 gap-2 px-3 py-2 items-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                  {((u.email||"?").split("@")[0].split(/[.\-_]/).filter(Boolean).slice(0,2).map(s=>s[0]?.toUpperCase()).join("")) || "U"}
                </div>
                <div>{u.email}</div>
              </div>
              <div className="text-gray-500">{new Date(u.createdAt).toLocaleString()}</div>
              <div className="flex gap-1">
                <span className={`px-2 py-0.5 rounded border ${u.approved ? "border-green-500" : "border-yellow-500"}`}>
                  {u.approved ? "Godkendt" : "Afventer"}
                </span>
                <span className={`px-2 py-0.5 rounded border ${u.active ? "border-green-500" : "border-red-500"}`}>
                  {u.active ? "Aktiv" : "Deaktiveret"}
                </span>
              </div>
              <div>
                <select
                  className="border rounded p-1"
                  value={u.role.toUpperCase()}
                  onChange={(e) => changeRole(u.id, e.target.value)}
                >
                  {roles.map(r => <option key={r} value={r}>{r}</option>)}
                </select>

                {!u.approved ? (
                  <button className="border rounded px-2 py-1" onClick={() => approveUser(u.id)}>Godkend</button>
                ) : (
                  u.role.toUpperCase() !== "ADMIN" && (
                    <button className="border rounded px-2 py-1" onClick={() => blockUser(u.id)}>Bloker</button>
                  )
                )}
                <button className="border rounded px-2 py-1 ml-2" onClick={() => toggleActive(u.id)}>
                  {u.active ? "Deaktiver" : "Genaktiver"}
                </button>
                <button
                  className="border rounded px-2 py-1 ml-2"
                  onClick={async ()=>{
                    const r = await fetch(`/api/admin/users/${u.id}/reset-password`, { method: "POST" });
                    const j = await r.json().catch(()=>({}));
                    if (!r.ok) return alert("Kunne ikke generere reset-link");
                    alert(`Reset-link:\n${j.resetUrl}`);
                  }}
                >
                  Reset password
                </button>

              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
