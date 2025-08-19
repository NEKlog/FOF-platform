// web/src/app/api/customer/tasks/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserFromCookie } from "@/lib/auth";
import { z } from "zod";
import crypto from "crypto";
import { sendMail } from "@/lib/mailer";
import {
  BookingCategory, ServiceLevel, ParkingDistance,
  BigItemBucket, BoxesBucket, ItemType, TaskStatus
} from "@prisma/client";

/* ----------------------------- Helpers ----------------------------- */

// Tolerant service-mapping (UI-venlige værdier -> DB-enum)
function mapService(input?: string | null): ServiceLevel | undefined {
  const v = (input || "").toUpperCase();
  if (!v) return undefined;
  if (v === "CURBSIDE") return "CURBSIDE";
  if (v === "ASSISTED" || v === "DRIVER_HELP") return "DRIVER_HELP";
  if (v === "FULL_INDOOR" || v === "TWO_MEN") return "TWO_MEN";
  return undefined;
}

// Legacy kind -> ny kategori
function mapKindToCategory(kind?: string | null): BookingCategory | undefined {
  switch ((kind || "").toUpperCase()) {
    case "MOVING": return "MOVING";
    case "FURNITURE": return "FURNITURE";
    case "PARCELS": return "PARCEL";
    case "PALLETS": return "PALLET_LTL";
    case "FTL": return "FTL";
    default: return undefined;
  }
}

// 14-dages defaultvindue
function computeWindow(fromStr?: string, toStr?: string) {
  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  if (fromStr && toStr) {
    const a = new Date(fromStr), b = new Date(toStr);
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }
  if (fromStr && !toStr) {
    const d = new Date(fromStr);
    return { from: d, to: d };
  }
  if (!fromStr && toStr) {
    const d = new Date(toStr);
    return { from: d, to: d };
  }
  return { from: now, to: in14 };
}

// Korte adresser til titel
function short(addr?: string | null): string {
  if (!addr) return "";
  return addr.split(",")[0] || addr;
}

// Rund til int (DB bruger Int? for mål/vægt)
const toIntOrNull = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  return null;
};

// Normalisér varelinjer (PACKAGE->PARCEL, afrund mål/vægt)
function normalizeItems(items: any[] | undefined): {
  type: ItemType;
  description: string | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightKg: number | null;
  count: number;
}[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((it) => {
    const rawType = (it?.type || "").toUpperCase();
    const type: ItemType =
      rawType === "PACKAGE" ? "PARCEL" :
      rawType === "PARCEL"  ? "PARCEL"  :
      rawType === "PALLET"  ? "PALLET"  :
      rawType === "FURNITURE" ? "FURNITURE" :
      "OTHER";

    return {
      type,
      description: it?.description ?? null,
      lengthCm: toIntOrNull(it?.lengthCm),
      widthCm:  toIntOrNull(it?.widthCm),
      heightCm: toIntOrNull(it?.heightCm),
      weightKg: toIntOrNull(it?.weightKg),
      count: typeof it?.count === "number" && it.count > 0 ? Math.floor(it.count) : 1,
    };
  });
}

/* ----------------------------- Zod skemaer ----------------------------- */

// Coercion helper (tal som strings -> number)
const zNum = z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number());

// Adresse-objekter
const AddressSchema = z.object({
  label: z.string().min(3),
  lat: zNum.optional(), // behold optionel for tolerance
  lon: zNum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  floor: zNum.pipe(z.number().int().min(0).max(100)).optional(),
  elevator: z.boolean().optional(),
  parking: z.nativeEnum(ParkingDistance).optional(),
  areaM2: zNum.pipe(z.number().int().min(1).max(10000)).optional(),
  storage: z.boolean().optional(),
  contactName: z.string().max(120).optional(),
  contactPhone: z.string().max(40).optional(),
});

// Varelinje (tolerant – normaliseres manuelt)
const ItemSchema = z.object({
  type: z.string(),
  description: z.string().max(500).optional(),
  lengthCm: zNum.optional(),
  widthCm: zNum.optional(),
  heightCm: zNum.optional(),
  weightKg: zNum.optional(),
  count: zNum.optional(),
});

// Ny primær create-schema (tolerant service)
const NewCreateSchema = z.object({
  category: z.nativeEnum(BookingCategory).optional(),
  kind: z.enum(["MOVING","FURNITURE","PARCELS","PALLETS","FTL"]).optional(),
  service: z.enum(["CURBSIDE","ASSISTED","FULL_INDOOR","DRIVER_HELP","TWO_MEN"]).optional(),
  pickup: AddressSchema,
  dropoff: AddressSchema,
  heavyOver70: z.boolean().optional(),
  bigItems: z.nativeEnum(BigItemBucket).optional(),
  boxes: z.nativeEnum(BoxesBucket).optional(),
  items: z.array(ItemSchema).optional(),
  notes: z.string().max(1000).optional(),
});

// Simpel legacy-payload (meget tidlig klient)
const LegacyCreateSchema = z.object({
  title: z.string().min(1),
  price: z.number().positive().optional(),
  pickup: z.string().max(500).optional(),
  dropoff: z.string().max(500).optional(),
  scheduledAt: z.string().datetime().optional(),
});

/* --------------------------------- GET --------------------------------- */
export async function GET(req: Request) {
  const me = await getUserFromCookie();
 if (!me || !["CUSTOMER", "ADMIN"].includes(String(me.role).toUpperCase())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 50)));
  const status = searchParams.get("status") as TaskStatus | null;

  const where: any = { customerId: me.id };
  if (status) where.status = status;

  const [total, items] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        title: true,
        status: true,
        price: true,

        category: true,
        service: true,

        pickupLabel: true,
        dropoffLabel: true,
        pickupFrom: true,
        pickupTo: true,
        dropoffFrom: true,
        dropoffTo: true,

        requiresActivation: true,
        isPublished: true,
        visibleAfter: true,

        createdAt: true,
        bids: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            carrierId: true,
            amount: true,
            message: true,
            carrier: { select: { id: true, email: true } },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({ total, page, pageSize, items });
}

/* --------------------------------- POST -------------------------------- */
// ADMIN-udvidelser på payload (valgfrit)
const AdminExtrasSchema = z.object({
  customerId: z.number().int().positive().optional(),
  assignCarrierId: z.number().int().positive().optional(),
  publishNow: z.boolean().optional(),          // publicér straks (spring aktivering over)
}).partial();

export async function POST(req: Request) {
  const me = await getUserFromCookie();           // { id, role, ... } eller null
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = String(me.role).toUpperCase() === "ADMIN";
  const isCustomer = String(me.role).toUpperCase() === "CUSTOMER";
  if (!isAdmin && !isCustomer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const raw = await req.json().catch(() => ({}));
  const parsedNew = NewCreateSchema.safeParse(raw);
  if (!parsedNew.success) {
    return NextResponse.json({ error: parsedNew.error.flatten() }, { status: 400 });
  }

  // Admin‐tilvalg (ignoreres for kunder)
  const adminExtra = isAdmin ? AdminExtrasSchema.safeParse(raw).data ?? {} : {};

  const d = parsedNew.data;
  const category = d.category ?? mapKindToCategory(d.kind);
  const service = mapService(d.service);
  const pf = computeWindow(d.pickup.from, d.pickup.to);
  const df = computeWindow(d.dropoff.from, d.dropoff.to);

  const label = category
    ? (category === "MOVING" ? "Flytning"
      : category === "FURNITURE" ? "Møbeltransport"
      : category === "PARCEL" ? "Pakker"
      : category === "PALLET_LTL" ? "Paller & stykgods"
      : category === "FTL" ? "Fullload"
      : "Opgave")
    : "Opgave";

  const title =
    `${label}: ${short(d.pickup.label)} → ${short(d.dropoff.label)}` +
    (d.notes ? ` · ${d.notes.slice(0, 120)}` : "");

  const normItems = normalizeItems(d.items);

  // Hvem er kunden?
  const customerId = isAdmin
    ? (adminExtra.customerId ?? me.id)   // admin kan vælge kunde; ellers sig selv
    : me.id;

  // Draft/aktivering/publishing
  const publishNow = isAdmin && adminExtra.publishNow === true;
  const requiresActivation = publishNow ? false : true;
  const isPublished = publishNow ? true : false;
  const visibleAfter = publishNow ? new Date() : null;

  // Evt. tildel carrier med det samme (admin)
  const carrierId = isAdmin ? (adminExtra.assignCarrierId ?? null) : null;

  const created = await prisma.task.create({
    data: {
      title,
      status: "NEW",
      customerId,

      category: category ?? null,
      service: service ?? null,

      // A (pickup)
      pickupLabel: d.pickup.label,
      pickupLat: typeof d.pickup.lat === "number" ? d.pickup.lat : null,
      pickupLon: typeof d.pickup.lon === "number" ? d.pickup.lon : null,
      pickupFrom: pf.from,
      pickupTo: pf.to,
      pickupFloor: d.pickup.floor ?? null,
      pickupElevator: Boolean(d.pickup.elevator),
      pickupParking: d.pickup.parking ?? null,
      pickupAreaM2: d.pickup.areaM2 ?? null,
      pickupStorage: Boolean(d.pickup.storage),
      contactAName: d.pickup.contactName ?? null,
      contactAPhone: d.pickup.contactPhone ?? null,

      // B (dropoff)
      dropoffLabel: d.dropoff.label,
      dropoffLat: typeof d.dropoff.lat === "number" ? d.dropoff.lat : null,
      dropoffLon: typeof d.dropoff.lon === "number" ? d.dropoff.lon : null,
      dropoffFrom: df.from,
      dropoffTo: df.to,
      dropoffFloor: d.dropoff.floor ?? null,
      dropoffElevator: Boolean(d.dropoff.elevator),
      dropoffParking: d.dropoff.parking ?? null,
      dropoffAreaM2: d.dropoff.areaM2 ?? null,
      dropoffStorage: Boolean(d.dropoff.storage),
      contactBName: d.dropoff.contactName ?? null,
      contactBPhone: d.dropoff.contactPhone ?? null,

      // Flytning
      heavyOver70: Boolean(d.heavyOver70),
      bigItems: d.bigItems ?? null,
      boxes: d.boxes ?? null,

      // Publicering/aktivering
      requiresActivation,
      isPublished,
      visibleAfter,

      // Direkte tildeling (admin)
      carrierId,

      // Varelinjer
      ...(normItems.length ? { items: { create: normItems } } : {}),
    },
    select: {
      id: true, title: true, status: true, category: true, service: true,
      pickupLabel: true, dropoffLabel: true,
      pickupFrom: true, pickupTo: true, dropoffFrom: true, dropoffTo: true,
      requiresActivation: true, isPublished: true, visibleAfter: true,
      customerId: true, carrierId: true, createdAt: true,
    },
  });

  return NextResponse.json(created, { status: 201 });
}
