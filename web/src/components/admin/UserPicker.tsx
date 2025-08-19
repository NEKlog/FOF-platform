"use client";

import { useEffect, useMemo, useState } from "react";

type Role = "CUSTOMER" | "CARRIER";
type UserHit = { id: number; email: string; role: string; approved: boolean; active: boolean };

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(() => setV(value), delay); return () => clearTimeout(id); }, [value, delay]);
  return v;
}

export default function UserPicker({
  role,
  value,
  onChange,
  placeholder = "Søg email…",
  disabled = false,
  label,
}: {
  role: Role;
  value: UserHit | null;
  onChange: (u: UserHit | null) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UserHit[]>([]);
  const debounced = useDebounced(q, 250);

  useEffect(() => {
    let alive = true;
    if (!debounced || debounced.length < 2) { setItems([]); return; }
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/users?role=${role}&q=${encodeURIComponent(debounced)}`);
        const j = await r.json().catch(()=>({ items: [] }));
        const arr: UserHit[] = j.items || j.users || [];
        if (alive) setItems(arr);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [debounced, role]);

  return (
    <div className="space-y-1">
      {label && <div className="text-sm font-medium">{label}</div>}
      <div className="relative">
        <input
          className="input w-full"
          value={value ? value.email : q}
          onChange={(e)=>{ onChange(null); setQ(e.target.value); setOpen(true); }}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),150)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {value && (
          <button
            type="button"
            className="absolute right-1 top-1 btn text-xs"
            onClick={()=>onChange(null)}
            title="Ryd"
          >
            Ryd
          </button>
        )}
        {open && (loading || items.length>0) && (
          <div className="absolute z-20 mt-1 w-full rounded border bg-white shadow">
            {loading && <div className="px-2 py-1 text-sm text-gray-500">Søger…</div>}
            {!loading && items.map(u=>(
              <button
                key={u.id}
                type="button"
                className="block w-full text-left px-2 py-1 hover:bg-gray-50"
                onMouseDown={(e)=>e.preventDefault()}
                onClick={()=>{ onChange(u); setOpen(false); }}
              >
                <div className="text-sm">{u.email}</div>
                <div className="text-xs text-gray-500">
                  #{u.id} · {u.role}{!u.active ? " · deaktiveret" : ""}{!u.approved ? " · ikke godkendt" : ""}
                </div>
              </button>
            ))}
            {!loading && items.length===0 && debounced.length>=2 && (
              <div className="px-2 py-1 text-sm text-gray-500">Ingen brugere</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
