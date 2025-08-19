"use client";

import { useEffect, useMemo, useState } from "react";

// Lightweight admin panel to list, filter, edit, reassign, retender and delete tasks.
// Drop this file into e.g. src/app/(dash)/admin/tasks/_components/AdminTasksManager.tsx
// and render it from src/app/(dash)/admin/tasks/page.tsx

// ---- enums (mirror Prisma enums) ----
const TASK_STATUS = ["NEW", "PLANNED", "IN_PROGRESS", "DELIVERED", "CANCELLED"] as const;
const BOOKING_CATEGORY = ["MOVING", "FURNITURE", "PARCEL", "PALLET_LTL", "FTL", "FREIGHT"] as const;
const SERVICE_LEVEL = ["CURBSIDE", "DRIVER_HELP", "TWO_MEN"] as const;
const PARKING_DISTANCE = ["D0_20", "D21_50", "D51_100", "OVER_100"] as const;
const BIG_ITEMS = ["I0_5","I6_10","I11_20","I21_30","I31_50","OVER_50"] as const;
const BOXES = ["B1_10","B11_20","B21_30","B31_40","B41_50","B71_100","B101_200","OVER_200"] as const;

// ---- small helpers ----
function cls(...xs: Array<string | false | null | undefined>) { return xs.filter(Boolean).join(" "); }
function fmtDateTimeLocal(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function toIsoOrNull(v: string) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ---- types (narrow) ----
type TaskLite = {
  id: number;
  title: string;
  status: typeof TASK_STATUS[number];
  price: number | null;
  pickupLabel: string | null;
  dropoffLabel: string | null;
  pickupFrom: string | null;
  pickupTo: string | null;
  dropoffFrom: string | null;
  dropoffTo: string | null;
  category: typeof BOOKING_CATEGORY[number] | null;
  service: typeof SERVICE_LEVEL[number] | null;
  customerId: number | null;
  carrierId: number | null;
  createdAt: string;
};

type TaskFull = TaskLite & {
  pickupLat?: number | null; pickupLon?: number | null; pickupFloor?: number | null; pickupElevator?: boolean; pickupParking?: typeof PARKING_DISTANCE[number] | null; pickupAreaM2?: number | null; pickupStorage?: boolean; contactAName?: string | null; contactAPhone?: string | null;
  dropoffLat?: number | null; dropoffLon?: number | null; dropoffFloor?: number | null; dropoffElevator?: boolean; dropoffParking?: typeof PARKING_DISTANCE[number] | null; dropoffAreaM2?: number | null; dropoffStorage?: boolean; contactBName?: string | null; contactBPhone?: string | null;
  requiresActivation?: boolean; isPublished?: boolean; visibleAfter?: string | null;
  notes?: string | null;
  items?: Array<any>;
};

// ---- fetch helpers ----
async function fetchList(q: string, status: string, page = 1) {
  const u = new URL("/api/admin/tasks", location.origin);
  if (q) u.searchParams.set("q", q);
  if (status) u.searchParams.set("status", status);
  u.searchParams.set("page", String(page));
  const r = await fetch(u.toString(), { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json(); // { total, items, page, pageSize }
}
async function fetchOne(id: number): Promise<TaskFull> {
  const r = await fetch(`/api/admin/tasks/${id}`, { cache: "no-store" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function patchOne(id: number, data: any) {
  const r = await fetch(`/api/admin/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function deleteOne(id: number) {
  const r = await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// --- small debounce hook for typeahead ---
function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value as any);
  useEffect(() => { const id = setTimeout(() => setV(value as any), delay); return () => clearTimeout(id); }, [value, delay]);
  return v as T;
}

// --- lightweight customer search (admin only) ---
 type UserHit = { id: number; email: string; role?: string; approved?: boolean; active?: boolean };
 async function searchCustomers(q: string): Promise<UserHit[]> {
  if (!q || q.trim().length < 2) return [];
  try {
    const u = new URL("/api/admin/users", location.origin);
    u.searchParams.set("role", "CUSTOMER");
    u.searchParams.set("q", q.trim());
    const r = await fetch(u.toString(), { cache: "no-store" });
    if (!r.ok) return [];
    const data = await r.json();
    // accept either {items:[..]} or {users:[..]}
    return (data.items || data.users || []) as UserHit[];
  } catch { return []; }
 }

 function CustomerPicker({ value, onChange }: { value: number | null; onChange: (id: number | null, user?: UserHit) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<UserHit[]>([]);
  const deb = useDebounced(q, 250);

  useEffect(() => { (async () => {
    setLoading(true);
    const res = await searchCustomers(deb);
    setHits(res);
    setLoading(false);
  })(); }, [deb]);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder={value ? `Tilknyttet ID: ${value} — søg for at skifte…` : "Søg kunde via email…"}
          value={q}
          onChange={(e)=>{ setQ(e.target.value); setOpen(true); }}
          onFocus={()=>setOpen(true)}
        />
        {value!=null && (
          <button type="button" className="btn" onClick={()=>onChange(null)}>Fjern</button>
        )}
      </div>
      {open && (loading || hits.length>0) && (
        <div className="absolute z-10 mt-1 w-full border rounded bg-white shadow">
          {loading && <div className="p-2 text-xs text-gray-500">Søger…</div>}
          {!loading && hits.map(u=> (
            <button key={u.id} type="button" className="w-full text-left px-2 py-1 hover:bg-gray-50"
              onMouseDown={(e)=>e.preventDefault()} onClick={()=>{ onChange(u.id, u); setOpen(false); setQ(""); }}>
              <div className="text-sm">{u.email}</div>
              <div className="text-[11px] text-gray-500">id:{u.id}{u.approved===false?" · ikke godkendt":""}{u.active===false?" · deaktiveret":""}</div>
            </button>
          ))}
          {!loading && hits.length===0 && deb.trim().length>=2 && (
            <div className="p-2 text-xs text-gray-500">Ingen kunder fundet</div>
          )}
        </div>
      )}
    </div>
  );
 }

export default function AdminTasksManager() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TaskLite[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<TaskFull | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // load list
  useEffect(() => { (async () => {
    setLoading(true); setMsg(null);
    try { const data = await fetchList(q, status, page); setItems(data.items); setTotal(data.total); }
    catch (e: any) { setMsg(e?.message || "Kunne ikke hente liste"); }
    finally { setLoading(false); }
  })(); }, [q, status, page]);

  // load detail
  useEffect(() => { (async () => {
    if (!selectedId) { setDetail(null); return; }
    setMsg(null);
    try { const d = await fetchOne(selectedId); setDetail(d); }
    catch (e: any) { setMsg(e?.message || "Kunne ikke hente opgave"); }
  })(); }, [selectedId]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / 20)), [total]);

  function onChangeDetail<K extends keyof TaskFull>(key: K, value: TaskFull[K]) {
    if (!detail) return;
    setDetail({ ...detail, [key]: value });
  }

  async function onSave() {
    if (!detail) return;
    setSaving(true); setMsg(null);
    try {
      const payload: any = {
        title: detail.title,
        status: detail.status,
        price: detail.price === null || detail.price === undefined || Number.isNaN(detail.price as any) ? null : Number(detail.price),
        category: detail.category,
        service: detail.service,
        notes: detail.notes ?? null,
        pickup: {
          label: detail.pickupLabel ?? undefined,
          from: detail.pickupFrom ?? undefined,
          to: detail.pickupTo ?? undefined,
          floor: detail.pickupFloor ?? undefined,
          elevator: detail.pickupElevator ?? undefined,
          parking: detail.pickupParking ?? undefined,
          areaM2: detail.pickupAreaM2 ?? undefined,
          storage: detail.pickupStorage ?? undefined,
          contactName: detail.contactAName ?? undefined,
          contactPhone: detail.contactAPhone ?? undefined,
        },
        dropoff: {
          label: detail.dropoffLabel ?? undefined,
          from: detail.dropoffFrom ?? undefined,
          to: detail.dropoffTo ?? undefined,
          floor: detail.dropoffFloor ?? undefined,
          elevator: detail.dropoffElevator ?? undefined,
          parking: detail.dropoffParking ?? undefined,
          areaM2: detail.dropoffAreaM2 ?? undefined,
          storage: detail.dropoffStorage ?? undefined,
          contactName: detail.contactBName ?? undefined,
          contactPhone: detail.contactBPhone ?? undefined,
        },
        customerId: detail.customerId ?? null,
        carrierId: detail.carrierId ?? null,
      };

      const updated = await patchOne(detail.id, payload);
      setDetail(updated);
      setMsg("Gemt ✓");
    } catch (e: any) {
      setMsg(e?.message || "Fejl ved gem");
    } finally { setSaving(false); }
  }

  async function actionPublishNow() { if (!detail) return; setSaving(true); setMsg(null); try { const updated = await patchOne(detail.id, { publishNow: true }); setDetail(updated); setMsg("Publiceret nu ✓"); } catch(e:any){ setMsg(e?.message||"Fejl"); } finally { setSaving(false); } }
  async function actionUnpublish() { if (!detail) return; setSaving(true); setMsg(null); try { const updated = await patchOne(detail.id, { unpublish: true }); setDetail(updated); setMsg("Afpubliceret ✓"); } catch(e:any){ setMsg(e?.message||"Fejl"); } finally { setSaving(false); } }
  async function actionRetender(clearWhitelist: boolean) { if (!detail) return; setSaving(true); setMsg(null); try { const updated = await patchOne(detail.id, { retender: true, clearWhitelist }); setDetail(updated); setMsg(clearWhitelist?"Udbudt igen + whitelist ryddet ✓":"Udbudt igen ✓"); } catch(e:any){ setMsg(e?.message||"Fejl"); } finally { setSaving(false); } }
  async function actionReassign(carrierId: number) { if (!detail) return; setSaving(true); setMsg(null); try { const updated = await patchOne(detail.id, { reassignCarrierId: carrierId }); setDetail(updated); setMsg("Opgave omdirigeret ✓"); } catch(e:any){ setMsg(e?.message||"Fejl"); } finally { setSaving(false); } }
  async function actionSetVisibleDelay(ms: number) { if (!detail) return; setSaving(true); setMsg(null); try { const updated = await patchOne(detail.id, { visibleAfterMsFromNow: ms }); setDetail(updated); setMsg("Synlighed opdateret ✓"); } catch(e:any){ setMsg(e?.message||"Fejl"); } finally { setSaving(false); } }

  async function onDelete() {
    if (!detail) return;
    if (!confirm(`Slet opgave #${detail.id}?`)) return;
    setSaving(true); setMsg(null);
    try { await deleteOne(detail.id); setMsg("Slettet ✓"); setSelectedId(null); setDetail(null); setPage(1); }
    catch(e:any){ setMsg(e?.message || "Kunne ikke slette"); }
    finally { setSaving(false); }
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* LEFT: list & filters */}
      <div className="md:w-1/2 border rounded-xl bg-white overflow-hidden">
        <div className="p-3 border-b flex gap-2 items-center">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Søg titel…" className="input flex-1" />
          <select value={status} onChange={e=>{ setStatus(e.target.value); setPage(1); }} className="input w-40">
            <option value="">Alle statusser</option>
            {TASK_STATUS.map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="max-h-[70vh] overflow-auto divide-y">
          {loading && <div className="p-3 text-sm text-gray-500">Henter…</div>}
          {!loading && items.length===0 && <div className="p-3 text-sm text-gray-500">Ingen opgaver</div>}
          {!loading && items.map(it=> (
            <button key={it.id} onClick={()=>setSelectedId(it.id)} className={cls("w-full text-left p-3 hover:bg-gray-50", selectedId===it.id && "bg-blue-50")}> 
              <div className="font-medium text-sm line-clamp-1">#{it.id} · {it.title}</div>
              <div className="text-xs text-gray-500 flex gap-2 mt-1">
                <span className="px-1.5 py-0.5 border rounded">{it.status}</span>
                {it.category && <span className="px-1.5 py-0.5 border rounded">{it.category}</span>}
                {it.service && <span className="px-1.5 py-0.5 border rounded">{it.service}</span>}
                {it.customerId!=null && <span className="px-1.5 py-0.5 border rounded">cust:{it.customerId}</span>}
                {it.carrierId!=null && <span className="px-1.5 py-0.5 border rounded">car:{it.carrierId}</span>}
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t flex items-center justify-between text-sm">
          <div>{total} opg.</div>
          <div className="flex gap-2 items-center">
            <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Forrige</button>
            <div>Side {page}/{totalPages}</div>
            <button className="btn" disabled={page>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Næste</button>
          </div>
        </div>
      </div>

      {/* RIGHT: detail */}
      <div className="md:w-1/2 border rounded-xl bg-white p-3">
        {!detail && <div className="text-sm text-gray-500">Vælg en opgave i listen for at redigere.</div>}
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">#{detail.id} – Redigér</div>
              <div className="text-xs text-gray-500">Oprettet: {new Date(detail.createdAt).toLocaleString()}</div>
            </div>

            {msg && <div className="p-2 bg-yellow-50 border rounded text-xs">{msg}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs">Titel</label>
                <input className="input" value={detail.title} onChange={e=>onChangeDetail("title", e.target.value)} />
              </div>
              <div>
                <label className="text-xs">Status</label>
                <select className="input" value={detail.status} onChange={e=>onChangeDetail("status", e.target.value as any)}>
                  {TASK_STATUS.map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs">Pris (DKK)</label>
                <input type="number" className="input" value={detail.price ?? ""} onChange={e=>onChangeDetail("price", e.target.value===""? null : Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs">Kategori</label>
                <select className="input" value={detail.category ?? ""} onChange={e=>onChangeDetail("category", (e.target.value||null) as any)}>
                  <option value="">—</option>
                  {BOOKING_CATEGORY.map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs">Service</label>
                <select className="input" value={detail.service ?? ""} onChange={e=>onChangeDetail("service", (e.target.value||null) as any)}>
                  <option value="">—</option>
                  {SERVICE_LEVEL.map(s=> <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs">Noter</label>
                <textarea className="input" rows={2} value={detail.notes ?? ""} onChange={e=>onChangeDetail("notes", e.target.value)} />
              </div>
            </div>

            {/* Pickup */}
            <div className="border rounded p-3">
              <div className="font-medium mb-2">Afhentning (A)</div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2"><label className="text-xs">Adresse</label><input className="input" value={detail.pickupLabel ?? ""} onChange={e=>onChangeDetail("pickupLabel", e.target.value)} /></div>
                <div><label className="text-xs">Fra</label><input type="datetime-local" className="input" value={fmtDateTimeLocal(detail.pickupFrom)} onChange={e=>onChangeDetail("pickupFrom", toIsoOrNull(e.target.value))} /></div>
                <div><label className="text-xs">Til</label><input type="datetime-local" className="input" value={fmtDateTimeLocal(detail.pickupTo)} onChange={e=>onChangeDetail("pickupTo", toIsoOrNull(e.target.value))} /></div>
                <div><label className="text-xs">Etage</label><input type="number" className="input" value={detail.pickupFloor ?? ""} onChange={e=>onChangeDetail("pickupFloor", e.target.value===""? null : Number(e.target.value))} /></div>
                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!detail.pickupElevator} onChange={e=>onChangeDetail("pickupElevator", e.target.checked)} /> Elevator</label>
                <div><label className="text-xs">Parkering</label><select className="input" value={detail.pickupParking ?? ""} onChange={e=>onChangeDetail("pickupParking", (e.target.value||null) as any)}><option value="">—</option>{PARKING_DISTANCE.map(p=> <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="text-xs">m²</label><input type="number" className="input" value={detail.pickupAreaM2 ?? ""} onChange={e=>onChangeDetail("pickupAreaM2", e.target.value===""? null : Number(e.target.value))} /></div>
                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!detail.pickupStorage} onChange={e=>onChangeDetail("pickupStorage", e.target.checked)} /> Opbevaring</label>
                <div><label className="text-xs">Kontakt navn</label><input className="input" value={detail.contactAName ?? ""} onChange={e=>onChangeDetail("contactAName", e.target.value)} /></div>
                <div><label className="text-xs">Kontakt tlf.</label><input className="input" value={detail.contactAPhone ?? ""} onChange={e=>onChangeDetail("contactAPhone", e.target.value)} /></div>
              </div>
            </div>

            {/* Dropoff */}
            <div className="border rounded p-3">
              <div className="font-medium mb-2">Levering (B)</div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="md:col-span-2"><label className="text-xs">Adresse</label><input className="input" value={detail.dropoffLabel ?? ""} onChange={e=>onChangeDetail("dropoffLabel", e.target.value)} /></div>
                <div><label className="text-xs">Fra</label><input type="datetime-local" className="input" value={fmtDateTimeLocal(detail.dropoffFrom)} onChange={e=>onChangeDetail("dropoffFrom", toIsoOrNull(e.target.value))} /></div>
                <div><label className="text-xs">Til</label><input type="datetime-local" className="input" value={fmtDateTimeLocal(detail.dropoffTo)} onChange={e=>onChangeDetail("dropoffTo", toIsoOrNull(e.target.value))} /></div>
                <div><label className="text-xs">Etage</label><input type="number" className="input" value={detail.dropoffFloor ?? ""} onChange={e=>onChangeDetail("dropoffFloor", e.target.value===""? null : Number(e.target.value))} /></div>
                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!detail.dropoffElevator} onChange={e=>onChangeDetail("dropoffElevator", e.target.checked)} /> Elevator</label>
                <div><label className="text-xs">Parkering</label><select className="input" value={detail.dropoffParking ?? ""} onChange={e=>onChangeDetail("dropoffParking", (e.target.value||null) as any)}><option value="">—</option>{PARKING_DISTANCE.map(p=> <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="text-xs">m²</label><input type="number" className="input" value={detail.dropoffAreaM2 ?? ""} onChange={e=>onChangeDetail("dropoffAreaM2", e.target.value===""? null : Number(e.target.value))} /></div>
                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!detail.dropoffStorage} onChange={e=>onChangeDetail("dropoffStorage", e.target.checked)} /> Opbevaring</label>
                <div><label className="text-xs">Kontakt navn</label><input className="input" value={detail.contactBName ?? ""} onChange={e=>onChangeDetail("contactBName", e.target.value)} /></div>
                <div><label className="text-xs">Kontakt tlf.</label><input className="input" value={detail.contactBPhone ?? ""} onChange={e=>onChangeDetail("contactBPhone", e.target.value)} /></div>
              </div>
            </div>

            {/* Relations & actions */}
            <div className="border rounded p-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs">Customer</label>
                  <CustomerPicker value={detail.customerId ?? null} onChange={(id)=>onChangeDetail("customerId", id)} />
                </div>
                <div>
                  <label className="text-xs">Carrier ID</label>
                  <input type="number" className="input" value={detail.carrierId ?? ""} onChange={e=>onChangeDetail("carrierId", e.target.value===""? null : Number(e.target.value))} />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn" disabled={saving} onClick={onSave}>Gem</button>
                <button className="btn" disabled={saving} onClick={actionPublishNow}>Publicér nu</button>
                <button className="btn" disabled={saving} onClick={actionUnpublish}>Afpublicér</button>
                <button className="btn" disabled={saving} onClick={()=>actionRetender(false)}>Retender</button>
                <button className="btn" disabled={saving} onClick={()=>actionRetender(true)}>Retender + ryd whitelist</button>
                <button className="btn" disabled={saving} onClick={()=>{
                  const v = prompt("Nyt carrierId");
                  if (!v) return; const id = Number(v); if (!Number.isFinite(id)) return alert("Ugyldigt id");
                  actionReassign(id);
                }}>Omdirigér carrier…</button>
                <button className="btn" disabled={saving} onClick={()=>{
                  const v = prompt("Synlig om X minutter (fx 120)");
                  if (!v) return; const min = Number(v); if (!Number.isFinite(min)) return alert("Ugyldigt tal");
                  actionSetVisibleDelay(min*60*1000);
                }}>Planlæg synlighed…</button>
                <button className="btn !bg-red-600 !text-white" disabled={saving} onClick={onDelete}>Slet</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
