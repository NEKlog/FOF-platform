// web/src/app/(dash)/customer/book/booking.client.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

/* ----------------- typer ----------------- */
type Kind = "MOVING" | "FURNITURE" | "PARCELS" | "PALLETS" | "FTL";
type Step = 1 | 2 | 3;
type GeoChoice = { label: string; lat: number; lon: number };

type ServiceLevel = "CURBSIDE" | "ASSISTED" | "FULL_INDOOR";
const SERVICE_LABEL: Record<ServiceLevel, string> = {
  CURBSIDE: "Kantstenslevering",
  ASSISTED: "Chauffør hjælper med indbæring",
  FULL_INDOOR: "Indbæring med 2+ flyttefolk",
};

const CARDS: { key: Kind; emoji: string; title: string; desc: string }[] = [
  { key: "MOVING",    emoji: "📦", title: "Flytning",               desc: "Privat & erhverv" },
  { key: "FURNITURE", emoji: "🛋️", title: "Møbeltransport",        desc: "Skrøbeligt/enkeltstyks" },
  { key: "PARCELS",   emoji: "📬", title: "Pakker < 25 kg",         desc: "Ofte fast pris" },
  { key: "PALLETS",   emoji: "🧱", title: "Paller & stykgods",      desc: "Zoner/vægt = fast pris" },
  { key: "FTL",       emoji: "🚚", title: "Fullload (FTL)",         desc: "DK/Skandinavien (RFQ)" },
];

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ---------- enums (UI->DB mapping helpers) ---------- */
type ParkingEnum = "D0_20" | "D21_50" | "D51_100" | "OVER_100";
function mapParking(ui: string | ""): ParkingEnum | undefined {
  switch (ui) {
    case "0-20 m": return "D0_20";
    case "21-50 m": return "D21_50";
    case "51-100 m": return "D51_100";
    case ">100 m": return "OVER_100";
    default: return undefined;
  }
}

type ServiceDb = "CURBSIDE" | "DRIVER_HELP" | "TWO_MEN";
function mapService(ui: ServiceLevel | null): ServiceDb | undefined {
  if (!ui) return undefined;
  if (ui === "CURBSIDE") return "CURBSIDE";
  if (ui === "ASSISTED") return "DRIVER_HELP";
  return "TWO_MEN"; // FULL_INDOOR
}

type BigItemDb = "I0_5"|"I6_10"|"I11_20"|"I21_30"|"I31_50"|"OVER_50";
function mapBigItems(ui: string | ""): BigItemDb | undefined {
  switch (ui) {
    case "0-5": return "I0_5";
    case "6-10": return "I6_10";
    case "11-20": return "I11_20";
    case "21-30": return "I21_30";
    case "31-50": return "I31_50";
    case "flere end 50": return "OVER_50";
    default: return undefined;
  }
}

type BoxesDb = "B1_10"|"B11_20"|"B21_30"|"B31_40"|"B41_50"|"B51_70"|"B71_100"|"B101_200"|"OVER_200";
function mapBoxes(ui: string | ""): BoxesDb | undefined {
  const m: Record<string, BoxesDb> = {
    "1-10":"B1_10","11-20":"B11_20","21-30":"B21_30","31-40":"B31_40","41-50":"B41_50",
    "51-70":"B51_70","71-100":"B71_100","101-200":"B101_200","over 200":"OVER_200"
  };
  return m[ui];
}

/* ---------- Address autocomplete ---------- */
type GeoSuggestion = {
  label: string;
  lat: number;
  lon: number;
  city: string | null;
  postcode: string | null;
  road: string | null;
  house_number: string | null;
};

function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value);
  useEffect(() => { const id = setTimeout(()=>setV(value), delay); return ()=>clearTimeout(id); }, [value, delay]);
  return v;
}

function AddressInput({
  placeholder,
  value,
  onPick,
}: {
  placeholder: string;
  value?: GeoSuggestion | null;
  onPick: (sel: GeoSuggestion) => void;
}) {
  const [q, setQ] = useState(value?.label || "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<GeoSuggestion[]>([]);
  const debounced = useDebounced(q, 250);

  useEffect(() => {
    let alive = true;
    async function run() {
      if (!debounced || debounced.length < 3) { if (alive) setItems([]); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/geo/search?q=${encodeURIComponent(debounced)}&country=dk&limit=6`);
        const data = await res.json();
        if (alive) setItems(Array.isArray(data) ? data : []);
      } catch { if (alive) setItems([]); } finally { if (alive) setLoading(false); }
    }
    run();
    return () => { alive = false; };
  }, [debounced]);

  function pick(sel: GeoSuggestion) { setQ(sel.label); setOpen(false); onPick(sel); }

  return (
    <div className="autocomplete">
      <input
        className="input"
        placeholder={placeholder}
        value={q}
        onChange={(e)=>{ setQ(e.target.value); setOpen(true); }}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false), 150)}
      />
      {open && (loading || items.length>0) && (
        <div className="autocomplete__panel">
          {loading && <div className="autocomplete__item muted">Søger…</div>}
          {!loading && items.map((it,i)=>(
            <button key={i} type="button" className="autocomplete__item" onMouseDown={(e)=>e.preventDefault()} onClick={()=>pick(it)}>
              {it.label}
            </button>
          ))}
          {!loading && items.length===0 && debounced.length>=3 && <div className="autocomplete__item muted">Ingen resultater</div>}
        </div>
      )}
    </div>
  );
}

/* ---------- Leaflet route preview ---------- */
function RouteMap({ from, to }: { from: GeoChoice; to: GeoChoice }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null); // husk map-instans

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let Lmod: any;
    let poly: any;

    (async () => {
      const Leaflet = await import("leaflet");
      Lmod = Leaflet.default;

      // Init map én gang
      if (!mapRef.current) {
        mapRef.current = Lmod.map(el, { zoomControl: true });
        const key = process.env.NEXT_PUBLIC_MAPTILER_KEY;
        const url = key
          ? `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${key}`
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
        Lmod.tileLayer(url, {
          attribution: key ? '&copy; MapTiler & OpenStreetMap contributors' : '&copy; OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;

      // ryd gamle markers/polyline
      if ((map as any)._layerPane) {
        (map as any)._layerPane.innerHTML = "";
      }


      // markers
      Lmod.circleMarker([from.lat, from.lon], { radius: 8 }).addTo(map);
      Lmod.circleMarker([to.lat, to.lon], { radius: 8 }).addTo(map);

      const bounds = Lmod.latLngBounds([[from.lat, from.lon],[to.lat, to.lon]]);
      map.fitBounds(bounds.pad(0.3));

      // rute
      try {
        const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`);
        const j = await r.json();
        const coords = j?.routes?.[0]?.geometry?.coordinates ?? [];
        if (coords.length) {
          const latlngs = coords.map((c: [number, number]) => [c[1], c[0]]);
          poly = Lmod.polyline(latlngs, { weight: 5 }).addTo(map);
          map.fitBounds(poly.getBounds().pad(0.2));
        }
      } catch {}
    })();

    return () => {
      // i dev/strict mode kører effect to gange → fjern map ved unmount
      // (bevar dog mapRef så vi ikke crash’er hvis next mount er straks efter)
    };
  }, [from.lat, from.lon, to.lat, to.lon]);

  return <div ref={ref} className="w-full h-[360px] rounded border overflow-hidden" />;
}





/* ------------ varer (pakker/paller/andet) ------------ */
type ItemType = "PACKAGE" | "PALLET" | "OTHER";
type Item = { type: ItemType; length: number | ""; width: number | ""; height: number | ""; weight: number | ""; qty: number };

function ItemsEditor({ items, setItems, defaultType }: { items: Item[]; setItems: (v: Item[])=>void; defaultType: ItemType; }) {
  function update(i: number, patch: Partial<Item>) { const next = items.slice(); next[i] = { ...next[i], ...patch }; setItems(next); }
  function add() { setItems([...items, { type: defaultType, length:"", width:"", height:"", weight:"", qty:1 }]); }
  function remove(i: number) { const next = items.slice(); next.splice(i,1); setItems(next.length?next:[{ type: defaultType, length:"", width:"", height:"", weight:"", qty:1 }]); }

  return (
    <div className="space-y-2">
      <div className="font-medium">Godstype & mål</div>
      {items.map((it,i)=>(
        <div key={i} className="grid md:grid-cols-12 gap-2 items-end border rounded p-2 bg-white/60">
          <div className="md:col-span-2">
            <label className="text-xs block mb-1">Type</label>
            <select className="input" value={it.type} onChange={(e)=>update(i, { type: e.target.value as ItemType })}>
              <option value="PACKAGE">Pakke</option><option value="PALLET">Palle</option><option value="OTHER">Andet</option>
            </select>
          </div>
          {(["length","width","height"] as const).map((k)=>(
            <div key={k} className="md:col-span-2">
              <label className="text-xs block mb-1">{k==="length"?"Længde":k==="width"?"Bredde":"Højde"} (cm)</label>
              <input className="input" type="number" min={0} value={it[k] as any}
                onChange={(e)=>update(i, { [k]: e.target.value==="" ? "" : Math.max(0, Number(e.target.value)) } as any)} />
            </div>
          ))}
          <div className="md:col-span-2">
            <label className="text-xs block mb-1">Vægt (kg)</label>
            <input className="input" type="number" min={0} value={it.weight as any}
              onChange={(e)=>update(i, { weight: e.target.value==="" ? "" : Math.max(0, Number(e.target.value)) })}/>
          </div>
          <div className="md:col-span-1">
            <label className="text-xs block mb-1">Antal</label>
            <input className="input" type="number" min={1} value={it.qty} onChange={(e)=>update(i, { qty: Math.max(1, Number(e.target.value||1)) })}/>
          </div>
          <div className="md:col-span-1 flex justify-end"><button type="button" className="btn" onClick={()=>remove(i)}>Fjern</button></div>
        </div>
      ))}
      <button type="button" className="btn" onClick={add}>Tilføj linje</button>
    </div>
  );
}

/* -------------- dato-hjælpere -------------- */
function todayISO(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function addDaysISO(iso: string, days: number){const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()+days);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function shortDK(iso:string){const d=new Date(iso+"T00:00:00");return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;}

/* -------------- Hovedkomponent -------------- */
export default function BookingClient({ initialKind = "" as any }: { initialKind?: Kind | "" }) {
  const [step, setStep] = useState<Step>(1);
  const [kind, setKind] = useState<Kind | "">(initialKind ?? "");
  const [pickup, setPickup] = useState<GeoChoice | null>(null);
  const [dropoff, setDropoff] = useState<GeoChoice | null>(null);

  // kontakt pr. adresse
  const [fromName, setFromName] = useState("");   const [fromPhone, setFromPhone] = useState("");
  const [toName, setToName] = useState("");       const [toPhone, setToPhone] = useState("");
  const [sameContact, setSameContact] = useState(false);

  // sync levering-kontakt når "samme som afhentning" er markeret
  useEffect(() => {
    if (sameContact) { setToName(fromName); setToPhone(fromPhone); }
  }, [sameContact, fromName, fromPhone]);

  // dato-intervaller
  const [pickStart, setPickStart] = useState(""); const [pickEnd, setPickEnd] = useState("");
  const [dropStart, setDropStart] = useState(""); const [dropEnd, setDropEnd] = useState("");

  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(1);

  // flytning-specifikt
  const PARK_OPTS = ["0-20 m","21-50 m","51-100 m",">100 m"] as const;
  const FURN_BIG_OPTS = ["0-5","6-10","11-20","21-30","31-50","flere end 50"] as const;
  const BOX_OPTS = ["1-10","11-20","21-30","31-40","41-50","51-70","71-100","101-200","over 200"] as const;

  const [fromFloor, setFromFloor] = useState<number | "">("");  const [toFloor, setToFloor] = useState<number | "">("");
  const [fromElevator, setFromElevator] = useState(false);      const [toElevator, setToElevator] = useState(false);
  const [fromPark, setFromPark] = useState<(typeof PARK_OPTS)[number] | "">(""); const [toPark, setToPark] = useState<(typeof PARK_OPTS)[number] | "">("");
  const [over70kg, setOver70kg] = useState(false);  const [bigFurniture, setBigFurniture] = useState<(typeof FURN_BIG_OPTS)[number] | "">("");
  const [boxes, setBoxes] = useState<(typeof BOX_OPTS)[number] | "">("");
  const [fromM2, setFromM2] = useState<number | "">(""); const [toM2, setToM2] = useState<number | "">("");

  const [service, setService] = useState<ServiceLevel | null>(null);
  const [customerHelps, setCustomerHelps] = useState(false);
  const [wantsPacking, setWantsPacking] = useState(false);
  const [storageWanted, setStorageWanted] = useState(false); // kun for MOVING, vises i Service

  // varer (ikke flytning)
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    if (!kind || kind==="MOVING") { setItems([]); return; }
    if (items.length===0) {
      const def: Item = { type: kind==="PARCELS"?"PACKAGE":(kind==="PALLETS"?"PALLET":"OTHER"), length:"", width:"", height:"", weight:"", qty:1 };
      setItems([def]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // prefill kontakt hvis logget ind
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/auth/me", { cache: "no-store" });
        if (!r.ok) return;
        const me = await r.json();
        const emailLike = me?.user?.email || "";
        if (!fromName) setFromName(emailLike.split("@")[0] || "");
        if (!toName) setToName(emailLike.split("@")[0] || "");
      } catch {}
    })();
  }, []);

  function next() {
    if (step===1) { if (!kind) return alert("Vælg en kategori først."); setStep(2 as Step); return; }
    if (step===2) {
      if (!pickup || !dropoff) return alert("Vælg afhentning og levering.");
      if (!fromName || !fromPhone || !toName || !toPhone) return alert("Udfyld kontaktinfo ved begge adresser.");
      if ((kind==="MOVING" || kind==="FURNITURE") && !service) return alert("Vælg et service-niveau.");
      setStep(3 as Step); return;
    }
  }

  function safeSaveDraft(data: any) {
    try { if (typeof window !== "undefined") sessionStorage.setItem("booking_draft", JSON.stringify(data)); } catch {}
  }
  function safeLoadDraft(): any | null {
    try {
      if (typeof window === "undefined") return null;
      const raw = sessionStorage.getItem("booking_draft");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }



  async function ensureLoggedIn(): Promise<boolean> {
  try {
    const r = await fetch("/api/auth/me", { cache: "no-store" });
    if (r.ok) {
      const me = await r.json().catch(() => null);
      const role = String(me?.user?.role || "").toUpperCase();
      if (role === "CUSTOMER" || role === "ADMIN") return true;
      // logget ind, men ikke CUSTOMER → send til login/role-switch
      const next = encodeURIComponent(location.pathname + location.search);
      window.location.href = `/login?next=${next}`;
      return false;
    }
  } catch {/* ignore */}
  // ikke logget ind → gem kladde og send til login
  safeSaveDraft({
    kind, pickup, dropoff,
    fromName, fromPhone, toName, toPhone, sameContact,
    pickStart, pickEnd, dropStart, dropEnd,
    notes, count,
    fromFloor, toFloor, fromElevator, toElevator, fromPark, toPark, over70kg, bigFurniture, boxes,
    fromM2, toM2,
    items, service, customerHelps, wantsPacking, storageWanted,
  });
  const next = encodeURIComponent(location.pathname + location.search);
  window.location.href = `/login?next=${next}`;
  return false;
}


  function itemsSummary() {
    if (!items.length) return "";
    const label = (t: ItemType) => t==="PACKAGE"?"Pakke":t==="PALLET"?"Palle":"Andet";
    return items.map(it=>{
      const dim = (it.length||it.width||it.height) ? `${it.length||"?"}×${it.width||"?"}×${it.height||"?"}cm` : "ukendt str.";
      const w   = it.weight!=="" ? `${it.weight}kg` : "ukendt vægt";
      return `${it.qty}× ${label(it.type)} ${dim} ${w}`;
    }).join("; ");
  }

  async function submit() {
    if (!await ensureLoggedIn()) return;
    if (!pickup || !dropoff) return alert("Vælg afhentning og levering.");

    // map gammel kind -> ny BookingCategory
    const mappedCategory =
      kind === "PARCELS" ? "PARCEL" :
      kind === "PALLETS" ? "PALLET_LTL" :
      (kind as any) || undefined;

    // dato-defaults (14 dage) hvis tomt
    const pFrom = pickStart || todayISO();
    const pTo   = pickEnd   || addDaysISO(pFrom, 14);
    const dFrom = dropStart || todayISO();
    const dTo   = dropEnd   || addDaysISO(dFrom, 14);

    const body = {
      category: mappedCategory,
      service: mapService(service),
      pickup: {
        label: pickup.label,
        lat: pickup.lat,
        lon: pickup.lon,
        from: new Date(pFrom + "T00:00:00").toISOString(),
        to:   new Date(pTo   + "T23:59:59").toISOString(),
        // Flytning + Møbeltransport: etage/elevator
        floor: (kind==="MOVING" || kind==="FURNITURE") && fromFloor !== "" ? Number(fromFloor) : undefined,
        elevator: (kind==="MOVING" || kind==="FURNITURE") ? fromElevator : undefined,
        // Parkering kun Flytning
        parking: (kind==="MOVING") ? mapParking(fromPark) : undefined,
        // m² kun Flytning
        areaM2: (kind==="MOVING" && fromM2 !== "") ? Number(fromM2) : undefined,
        // opbevaring ønskes (kun Flytning) – sendes én gang → gem som begge steder for simpelt skema
        storage: kind==="MOVING" ? storageWanted : undefined,
        contactName: fromName || undefined,
        contactPhone: fromPhone || undefined,
      },
      dropoff: {
        label: dropoff.label,
        lat: dropoff.lat,
        lon: dropoff.lon,
        from: new Date(dFrom + "T00:00:00").toISOString(),
        to:   new Date(dTo   + "T23:59:59").toISOString(),
        floor: (kind==="MOVING" || kind==="FURNITURE") && toFloor !== "" ? Number(toFloor) : undefined,
        elevator: (kind==="MOVING" || kind==="FURNITURE") ? toElevator : undefined,
        parking: (kind==="MOVING") ? mapParking(toPark) : undefined,
        areaM2: (kind==="MOVING" && toM2 !== "") ? Number(toM2) : undefined,
        storage: kind==="MOVING" ? storageWanted : undefined,
        contactName: toName || undefined,
        contactPhone: toPhone || undefined,
      },
      heavyOver70: kind==="MOVING" ? (over70kg || undefined) : undefined,
      bigItems: kind==="MOVING" ? mapBigItems(bigFurniture) : undefined,
      boxes: kind==="MOVING" ? mapBoxes(boxes) : undefined,
      items: items.map(it => ({
        type: it.type === "PACKAGE" ? "PARCEL" : it.type === "PALLET" ? "PALLET" : "OTHER",
        lengthCm: it.length === "" ? undefined : Number(it.length),
        widthCm:  it.width  === "" ? undefined : Number(it.width),
        heightCm: it.height === "" ? undefined : Number(it.height),
        weightKg: it.weight === "" ? undefined : Number(it.weight),
        count: it.qty ?? 1,
      })),
      notes,
    };

    const res = await fetch("/api/customer/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      alert(`Kunne ikke oprette opgaven (${res.status}).\n${txt}`);
      return;
    }

    // Efter oprettelse → kvittering (opgaven er draft; aktivering/2FA/login styres server-side)
    window.location.href = "/customer?m=task_draft";
  }

   // genskab kladde
   useEffect(() => {
    const d = safeLoadDraft();
    if (!d) return;
    try {
      if (!kind && d.kind) setKind(d.kind);
      if (!pickup && d.pickup) setPickup(d.pickup);
      if (!dropoff && d.dropoff) setDropoff(d.dropoff);

      setFromName(d.fromName||""); setFromPhone(d.fromPhone||"");
      setToName(d.toName||"");     setToPhone(d.toPhone||"");
      setSameContact(Boolean(d.sameContact));

      setPickStart(d.pickStart||""); setPickEnd(d.pickEnd||"");
      setDropStart(d.dropStart||""); setDropEnd(d.dropEnd||"");

      if (!notes && d.notes) setNotes(d.notes);
      if (count===1 && d.count) setCount(d.count);

      setFromFloor(d.fromFloor ?? ""); setToFloor(d.toFloor ?? "");
      setFromElevator(Boolean(d.fromElevator)); setToElevator(Boolean(d.toElevator));
      setFromPark(d.fromPark ?? ""); setToPark(d.toPark ?? "");
      setOver70kg(Boolean(d.over70kg)); setBigFurniture(d.bigFurniture ?? ""); setBoxes(d.boxes ?? "");
      setFromM2(d.fromM2 ?? ""); setToM2(d.toM2 ?? "");
      if (Array.isArray(d.items)) setItems(d.items);
      setService(d.service ?? null); setCustomerHelps(Boolean(d.customerHelps)); setWantsPacking(Boolean(d.wantsPacking));
      setStorageWanted(Boolean(d.storageWanted));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  return (
    <section className="mx-auto max-w-5xl space-y-6">
      {/* Stepper */}
      <div className="flex justify-center gap-2 text-sm">
        {[1,2,3].map(n=>(
          <div key={n} className={cls("px-3 py-1 rounded-full border", step===n?"bg-gray-100 border-gray-400":"border-gray-300")}>
            {n}. {n===1?"Vælg kategori":n===2?"Detaljer":"Bekræft"}
          </div>
        ))}
      </div>

      {/* STEP 1 – kort */}
      {step===1 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 justify-items-center">
          {CARDS.map(c=>(
            <button key={c.key} type="button" onClick={()=>setKind(c.key)}
              className={cls("w-64 h-40 border rounded-2xl p-4 text-center shadow-sm hover:shadow-md bg-white flex flex-col items-center justify-center",
                            kind===c.key ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200")}>
              <div className="text-5xl">{c.emoji}</div>
              <div className="mt-2 font-semibold text-lg">{c.title}</div>
              <div className="text-xs text-gray-500">{c.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* STEP 2 – detaljer */}
      {step===2 && (
        <div className="space-y-4 border rounded p-4 bg-white">
          <div className="text-lg font-semibold">{CARDS.find(x=>x.key===kind)?.title ?? "Opgave"}</div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Afhentning */}
            <div className="border rounded p-3">
              <div className="font-medium mb-2">Afhentning</div>
              <AddressInput placeholder="Adresse" value={pickup as any} onPick={setPickup as any}/>
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                <input className="input" placeholder="Navn (kontakt)" value={fromName} onChange={e=>setFromName(e.target.value)} />
                <input className="input" placeholder="Telefon" value={fromPhone} onChange={e=>setFromPhone(e.target.value)} />
              </div>
            </div>

            {/* Levering */}
            <div className="border rounded p-3">
              <div className="font-medium mb-2">Levering</div>
              <AddressInput placeholder="Adresse" value={dropoff as any} onPick={setDropoff as any}/>
              <div className="grid sm:grid-cols-2 gap-2 mt-3 items-center">
                <input className="input" placeholder="Navn (kontakt)" value={toName} onChange={e=>setToName(e.target.value)} disabled={sameContact}/>
                <input className="input" placeholder="Telefon" value={toPhone} onChange={e=>setToPhone(e.target.value)} disabled={sameContact}/>
                <label className="flex items-center gap-2 text-sm sm:col-span-2 mt-1">
                  <input type="checkbox" checked={sameContact} onChange={e=>setSameContact(e.target.checked)} />
                  Samme kontakt som afhentning
                </label>
              </div>
            </div>
          </div>

          {/* Dato-intervaller */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded p-3">
              <div className="font-medium mb-2">Afhentningsperiode</div>
              <label className="text-sm block mb-1">Start</label><input type="date" className="input mb-3" value={pickStart} onChange={e=>setPickStart(e.target.value)} />
              <label className="text-sm block mb-1">Slut</label><input type="date" className="input" value={pickEnd} onChange={e=>setPickEnd(e.target.value)} />
              <p className="text-xs text-gray-500 mt-2">Tomt = {shortDK(todayISO())} – {shortDK(addDaysISO(todayISO(),14))}</p>
            </div>
            <div className="border rounded p-3">
              <div className="font-medium mb-2">Leveringsperiode</div>
              <label className="text-sm block mb-1">Start</label><input type="date" className="input mb-3" value={dropStart} onChange={e=>setDropStart(e.target.value)} />
              <label className="text-sm block mb-1">Slut</label><input type="date" className="input" value={dropEnd} onChange={e=>setDropEnd(e.target.value)} />
              <p className="text-xs text-gray-500 mt-2">Tomt = {shortDK(todayISO())} – {shortDK(addDaysISO(todayISO(),14))}</p>
            </div>
          </div>

          {/* Service-niveau */}
          {(kind==="MOVING" || kind==="FURNITURE") && (
            <div className="border rounded p-3 space-y-3">
              <div className="font-medium">Service-niveau</div>
              <div className="grid sm:grid-cols-3 gap-2">
                {(["CURBSIDE","ASSISTED","FULL_INDOOR"] as ServiceLevel[]).map(s=>(
                  <label key={s} className={cls("border rounded p-2 cursor-pointer flex items-center gap-2", service===s?"ring-2 ring-blue-300 border-blue-400":"border-gray-300")}>
                    <input type="radio" name="service" className="accent-blue-600" checked={service===s} onChange={()=>setService(s)} />
                    <span>{SERVICE_LABEL[s]}</span>
                  </label>
                ))}
              </div>

              {/* Kun Flytning: ekstra servicefelter */}
              {kind==="MOVING" && (
                <>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={customerHelps} onChange={e=>setCustomerHelps(e.target.checked)} />
                      Jeg hjælper selv til
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={wantsPacking} onChange={e=>setWantsPacking(e.target.checked)} />
                      Ønsker nedpakning
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={storageWanted} onChange={e=>setStorageWanted(e.target.checked)} />
                    Opbevaring ønskes
                  </label>
                </>
              )}
            </div>
          )}

          {/* Flytning + Møbeltransport: Etage/Elevator (parkering + m2 kun Flytning) */}
          {(kind==="MOVING" || kind==="FURNITURE") && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="border rounded p-3">
                  <div className="font-medium mb-2">Afhentning (A)</div>
                  <label className="text-sm block mb-1">Etage</label>
                  <input type="number" min={0} className="input mb-3" placeholder="0 = stue" value={fromFloor as any}
                    onChange={e=>setFromFloor(e.target.value===""?"":Math.max(0,Number(e.target.value)))} />
                  <label className="flex items-center gap-2 mb-3 text-sm">
                    <input type="checkbox" checked={fromElevator} onChange={e=>setFromElevator(e.target.checked)} /> Elevator
                  </label>
                  {kind==="MOVING" && (
                    <>
                      <label className="text-sm block mb-1">Afstand til parkering</label>
                      <select className="input mb-3" value={fromPark} onChange={e=>setFromPark(e.target.value as any)}>
                        <option value="">Vælg</option>{PARK_OPTS.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                      <label className="text-sm block mb-1">m² bolig</label>
                      <input className="input" type="number" min={0} value={fromM2 as any}
                        onChange={(e)=>setFromM2(e.target.value===""?"":Math.max(0,Number(e.target.value)))} />
                    </>
                  )}
                </div>

                <div className="border rounded p-3">
                  <div className="font-medium mb-2">Levering (B)</div>
                  <label className="text-sm block mb-1">Etage</label>
                  <input type="number" min={0} className="input mb-3" placeholder="0 = stue" value={toFloor as any}
                    onChange={e=>setToFloor(e.target.value===""?"":Math.max(0,Number(e.target.value)))} />
                  <label className="flex items-center gap-2 mb-3 text-sm">
                    <input type="checkbox" checked={toElevator} onChange={e=>setToElevator(e.target.checked)} /> Elevator
                  </label>
                  {kind==="MOVING" && (
                    <>
                      <label className="text-sm block mb-1">Afstand til parkering</label>
                      <select className="input mb-3" value={toPark} onChange={e=>setToPark(e.target.value as any)}>
                        <option value="">Vælg</option>{PARK_OPTS.map(o=><option key={o} value={o}>{o}</option>)}
                      </select>
                      <label className="text-sm block mb-1">m² bolig</label>
                      <input className="input" type="number" min={0} value={toM2 as any}
                        onChange={(e)=>setToM2(e.target.value===""?"":Math.max(0,Number(e.target.value)))} />
                    </>
                  )}
                </div>
              </div>

              {/* Kun Flytning: ekstra mængde-felter */}
              {kind==="MOVING" && (
                <div className="grid sm:grid-cols-3 gap-4">
                  <label className="flex items-center gap-2 text-sm border rounded p-3">
                    <input type="checkbox" checked={over70kg} onChange={e=>setOver70kg(e.target.checked)} /> Ting over 70 kg
                  </label>
                  <div>
                    <label className="text-sm block mb-1">Antal større møbler</label>
                    <select className="input" value={bigFurniture} onChange={e=>setBigFurniture(e.target.value as any)}>
                      <option value="">Vælg</option>{FURN_BIG_OPTS.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm block mb-1">Antal flyttekasser</label>
                    <select className="input" value={boxes} onChange={e=>setBoxes(e.target.value as any)}>
                      <option value="">Vælg</option>{BOX_OPTS.map(o=><option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Varer for ikke-flytning */}
          {kind!=="" && kind!=="MOVING" && (
            <ItemsEditor items={items} setItems={setItems}
              defaultType={kind==="PARCELS"?"PACKAGE":kind==="PALLETS"?"PALLET":"OTHER"} />
          )}

          {/* Noter */}
          {(kind==="FURNITURE" || kind==="FTL") && (
            <div>
              <label className="text-sm block mb-1">Noter</label>
              <textarea className="input" rows={3}
                placeholder={kind==="FURNITURE"?"Skrøbeligt, emballering, bære-hjælp…":"Lastbiltype, ramper, tidsvindue…"}
                value={notes} onChange={e=>setNotes(e.target.value)} />
            </div>
          )}

          {(kind==="PARCELS" || kind==="PALLETS") && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm block mb-1">Antal (hurtig)</label>
                <input type="number" min={1} className="input" value={count} onChange={e=>setCount(Math.max(1, Number(e.target.value||1)))} />
                <p className="text-xs text-gray-500 mt-1">Du kan også angive flere linjer ovenfor med mål og vægt.</p>
              </div>
              <div>
                <label className="text-sm block mb-1">Noter</label>
                <input className="input" placeholder="fx stablbar, lift/palleløfter?" value={notes} onChange={e=>setNotes(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3 – opsummering (kort + A/B blokke) */}
      {step===3 && pickup && dropoff && (
        <div className="border rounded p-4 bg-white space-y-4">
          <RouteMap from={pickup} to={dropoff} />

          {/* Afhentning & Levering */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded">
              <div className="px-3 py-2 font-medium border-b">Afhentning (A)</div>
              <div className="p-3 text-sm space-y-1">
                <div className="font-medium">{pickup.label}</div>
                <div>Periode: {shortDK(pickStart||todayISO())} – {shortDK(pickEnd||addDaysISO((pickStart||todayISO()),14))}</div>
                {(kind==="MOVING" || kind==="FURNITURE") && (
                  <>
                    <div>Etage: {fromFloor===""? "0" : fromFloor}</div>
                    <div>Elevator: {fromElevator ? "Ja" : "Nej"}</div>
                  </>
                )}
                {kind==="MOVING" && (
                  <>
                    <div>Afstand til parkering: {fromPark || "—"}</div>
                    <div>m² bolig: {fromM2===""? "—": fromM2}</div>
                  </>
                )}
                <div className="mt-2 text-xs text-gray-500">Kontakt: {fromName || "—"} {fromPhone ? `· ${fromPhone}` : ""}</div>
              </div>
            </div>

            <div className="border rounded">
              <div className="px-3 py-2 font-medium border-b">Levering (B)</div>
              <div className="p-3 text-sm space-y-1">
                <div className="font-medium">{dropoff.label}</div>
                <div>Periode: {shortDK(dropStart||todayISO())} – {shortDK(dropEnd||addDaysISO((dropStart||todayISO()),14))}</div>
                {(kind==="MOVING" || kind==="FURNITURE") && (
                  <>
                    <div>Etage: {toFloor===""? "0" : toFloor}</div>
                    <div>Elevator: {toElevator ? "Ja" : "Nej"}</div>
                  </>
                )}
                {kind==="MOVING" && (
                  <>
                    <div>Afstand til parkering: {toPark || "—"}</div>
                    <div>m² bolig: {toM2===""? "—": toM2}</div>
                  </>
                )}
                <div className="mt-2 text-xs text-gray-500">Kontakt: {toName || "—"} {toPhone ? `· ${toPhone}` : ""}</div>
              </div>
            </div>
          </div>

          {/* Service (fælles) */}
          {(kind==="MOVING" || kind==="FURNITURE") && (
            <div className="border rounded">
              <div className="px-3 py-2 font-medium border-b">Service</div>
              <div className="p-3 text-sm">
                {service ? SERVICE_LABEL[service] : "—"}
                {kind==="MOVING" && (
                  <div className="text-xs text-gray-500 mt-1">
                    {`Jeg hjælper selv til: ${customerHelps?"ja":"nej"} · Ønsker nedpakning: ${wantsPacking?"ja":"nej"} · Opbevaring ønskes: ${storageWanted?"ja":"nej"}`}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Emner / varer */}
          {kind!=="MOVING" && items.length>0 && (
            <div className="border rounded">
              <div className="px-3 py-2 font-medium border-b">Emner</div>
              <div className="p-3 text-sm">
                {items.map((it, i) => {
                  const dim = (it.length||it.width||it.height) ? `${it.length||"?"}×${it.width||"?"}×${it.height||"?"}cm` : "ukendt str.";
                  const w = it.weight!=="" ? `${it.weight}kg` : "ukendt vægt";
                  const label = it.type==="PACKAGE"?"Pakke":it.type==="PALLET"?"Palle":"Andet";
                  return <div key={i}>{`${it.qty}× ${label} ${dim} ${w}`}</div>;
                })}
              </div>
            </div>
          )}

          {/* Noter */}
          {notes && (
            <div className="border rounded">
              <div className="px-3 py-2 font-medium border-b">Ekstra</div>
              <div className="p-3 text-sm whitespace-pre-wrap">{notes}</div>
            </div>
          )}
        </div>
      )}

      {/* footer */}
      <div className="flex items-center justify-between">
        <button className="btn" onClick={()=>setStep(step>1?((step-1) as Step):1)} disabled={step===1}>Tilbage</button>
        {step<3 ? <button className="btn" onClick={next}>Næste</button> : <button className="btn" onClick={submit}>Bekræft & opret</button>}
      </div>
    </section>
  );
}

/* ————— små “utility”-klasser (bruges hvis du ikke har Tailwind helpers) ————— */
declare global { interface HTMLElementTagNameMap { } }
