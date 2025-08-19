// web/src/app/api/admin/tasks/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { z } from "zod";
import {
  TaskStatus,
  BookingCategory,
  ServiceLevel,
  ParkingDistance,
  BigItemBucket,
  BoxesBucket,
  ItemType,
} from "@prisma/client";

/* -------------------------- shared helpers -------------------------- */
const zNum = z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number());

const AddressPartial = z
  .object({
    label: z.string().min(3).optional(),
    lat: zNum.optional(),
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
  })
  .partial();

// Bruges hvis admin vil erstatte varelinjer i én omgang
const ItemPatchSchema = z.object({
  type: z.nativeEnum(ItemType),
  description: z.string().max(500).optional(),
  lengthCm: zNum.optional(),
  widthCm: zNum.optional(),
  heightCm: zNum.optional(),
  weightKg: zNum.optional(),
  count: zNum.optional(),
});

const PatchSchema = z
  .object({
    // alm. felter
    title: z.string().min(1).optional(),
    price: z.number().min(0).nullable().optional(),
    status: z.nativeEnum(TaskStatus).optional(),
    category: z.nativeEnum(BookingCategory).nullable().optional(),
    service: z.nativeEnum(ServiceLevel).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),

    // tider/adresser (delvise)
    pickup: AddressPartial.optional(),
    dropoff: AddressPartial.optional(),

    // flytning
    heavyOver70: z.boolean().optional(),
    bigItems: z.nativeEnum(BigItemBucket).nullable().optional(),
    boxes: z.nativeEnum(BoxesBucket).nullable().optional(),

    // synlighed/publicering
    isPublished: z.boolean().optional(),
    publishNow: z.boolean().optional(),
    unpublish: z.boolean().optional(),
    visibleAfterMsFromNow: z.number().int().min(0).optional(),
    requiresActivation: z.boolean().optional(),

    // relationer
    customerId: z.number().int().positive().nullable().optional(),
    carrierId: z.number().int().positive().nullable().optional(),

    // “operationer”
    reassignCarrierId: z.number().int().positive().optional(),
    retender: z.boolean().optional(), // sæt ud igen som åbent udbud
    clearWhitelist: z.boolean().optional(), // nulstil whitelist ved retender

    // fuld erstatning af varelinjer (valgfri)
    itemsReplace: z.array(ItemPatchSchema).optional(),
  })
  .partial();

function toDateOrUndefined(s?: string) {
  return s ? new Date(s) : undefined;
}

function intOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.round(v);
  return null;
}

/* ------------------------------ GET (single) ------------------------------ */
export async function GET(_req: Request, ctx: { params: { id: string } }) {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return NextResponse.json(error.json, { status: error.status });

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      items: true,
      bids: {
        orderBy: { createdAt: "desc" },
        include: { carrier: { select: { id: true, email: true } } },
      },
      whitelist: true,
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(task);
}

/* ------------------------------ PATCH (edit) ------------------------------ */
export async function PATCH(req: Request, ctx: { params: { id: string } }) {
  const { error } = await requireRole(["ADMIN"]); // eller: const { me, error } = ...
  if (error) return NextResponse.json(error.json, { status: error.status });

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // Validér relationer, hvis de er inkluderet
  if (d.customerId !== undefined && d.customerId !== null) {
    const cust = await prisma.user.findUnique({ where: { id: d.customerId }, select: { role: true } });
    if (!cust || String(cust.role).toUpperCase() !== "CUSTOMER") {
      return NextResponse.json({ error: "customerId skal referere til en CUSTOMER" }, { status: 400 });
    }
  }
  if (d.reassignCarrierId !== undefined) {
    const car = await prisma.user.findUnique({ where: { id: d.reassignCarrierId }, select: { role: true } });
    if (!car || String(car.role).toUpperCase() !== "CARRIER") {
      return NextResponse.json({ error: "reassignCarrierId skal referere til en CARRIER" }, { status: 400 });
    }
  }
  if (d.carrierId !== undefined && d.carrierId !== null) {
    const car = await prisma.user.findUnique({ where: { id: d.carrierId }, select: { role: true } });
    if (!car || String(car.role).toUpperCase() !== "CARRIER") {
      return NextResponse.json({ error: "carrierId skal referere til en CARRIER" }, { status: 400 });
    }
  }

  // Byg update-data
  const data: any = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.price !== undefined) data.price = d.price;
  if (d.status !== undefined) data.status = d.status;
  if (d.category !== undefined) data.category = d.category;
  if (d.service !== undefined) data.service = d.service;
  if (d.notes !== undefined) data.notes = d.notes;

  // pickup/dropoff (delvist)
  if (d.pickup) {
    if (d.pickup.label !== undefined) data.pickupLabel = d.pickup.label;
    if (d.pickup.lat !== undefined) data.pickupLat = d.pickup.lat;
    if (d.pickup.lon !== undefined) data.pickupLon = d.pickup.lon;
    if (d.pickup.from !== undefined) data.pickupFrom = toDateOrUndefined(d.pickup.from);
    if (d.pickup.to !== undefined) data.pickupTo = toDateOrUndefined(d.pickup.to);
    if (d.pickup.floor !== undefined) data.pickupFloor = d.pickup.floor;
    if (d.pickup.elevator !== undefined) data.pickupElevator = d.pickup.elevator;
    if (d.pickup.parking !== undefined) data.pickupParking = d.pickup.parking;
    if (d.pickup.areaM2 !== undefined) data.pickupAreaM2 = d.pickup.areaM2;
    if (d.pickup.storage !== undefined) data.pickupStorage = d.pickup.storage;
    if (d.pickup.contactName !== undefined) data.contactAName = d.pickup.contactName;
    if (d.pickup.contactPhone !== undefined) data.contactAPhone = d.pickup.contactPhone;
  }
  if (d.dropoff) {
    if (d.dropoff.label !== undefined) data.dropoffLabel = d.dropoff.label;
    if (d.dropoff.lat !== undefined) data.dropoffLat = d.dropoff.lat;
    if (d.dropoff.lon !== undefined) data.dropoffLon = d.dropoff.lon;
    if (d.dropoff.from !== undefined) data.dropoffFrom = toDateOrUndefined(d.dropoff.from);
    if (d.dropoff.to !== undefined) data.dropoffTo = toDateOrUndefined(d.dropoff.to);
    if (d.dropoff.floor !== undefined) data.dropoffFloor = d.dropoff.floor;
    if (d.dropoff.elevator !== undefined) data.dropoffElevator = d.dropoff.elevator;
    if (d.dropoff.parking !== undefined) data.dropoffParking = d.dropoff.parking;
    if (d.dropoff.areaM2 !== undefined) data.dropoffAreaM2 = d.dropoff.areaM2;
    if (d.dropoff.storage !== undefined) data.dropoffStorage = d.dropoff.storage;
    if (d.dropoff.contactName !== undefined) data.contactBName = d.dropoff.contactName;
    if (d.dropoff.contactPhone !== undefined) data.contactBPhone = d.dropoff.contactPhone;
  }

  // flytning
  if (d.heavyOver70 !== undefined) data.heavyOver70 = d.heavyOver70;
  if (d.bigItems !== undefined) data.bigItems = d.bigItems;
  if (d.boxes !== undefined) data.boxes = d.boxes;

  // relationer / (re)assign
  if (d.customerId !== undefined) data.customerId = d.customerId;
  if (d.carrierId !== undefined) data.carrierId = d.carrierId;
  if (d.reassignCarrierId !== undefined) data.carrierId = d.reassignCarrierId;

  // publicering/aktivering
  if (d.publishNow) {
    data.isPublished = true;
    data.visibleAfter = new Date();
    data.requiresActivation = false;
  }
  if (d.unpublish) {
    data.isPublished = false;
  }
  if (d.visibleAfterMsFromNow !== undefined) {
    data.visibleAfter = new Date(Date.now() + d.visibleAfterMsFromNow);
  }
  if (d.requiresActivation !== undefined) {
    data.requiresActivation = d.requiresActivation;
  }
  if (d.retender) {
    data.carrierId = null; // fjern evt. tildeling
    data.isPublished = true;
    data.visibleAfter = new Date();
  }

  // Kør selve update
  const updated = await prisma.task.update({
    where: { id },
    data,
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      service: true,
      pickupLabel: true,
      dropoffLabel: true,
      pickupFrom: true,
      pickupTo: true,
      dropoffFrom: true,
      dropoffTo: true,
      isPublished: true,
      requiresActivation: true,
      visibleAfter: true,
      customerId: true,
      carrierId: true,
      updatedAt: true,
    },
  });

  // Whitelist nulstilling efter retender
  if (d.retender && d.clearWhitelist) {
    await prisma.taskCarrierWhitelist.deleteMany({ where: { taskId: id } });
  }

  // Erstat varelinjer hvis anmodet
  if (Array.isArray(d.itemsReplace)) {
    // Ryd eksisterende
    await prisma.taskItem.deleteMany({ where: { taskId: id } });
    // Indlæs nye
    if (d.itemsReplace.length) {
      await prisma.taskItem.createMany({
        data: d.itemsReplace.map((it) => ({
          taskId: id,
          type: it.type,
          description: it.description ?? null,
          lengthCm: intOrNull(it.lengthCm),
          widthCm: intOrNull(it.widthCm),
          heightCm: intOrNull(it.heightCm),
          weightKg: intOrNull(it.weightKg),
          count: typeof it.count === "number" && it.count > 0 ? Math.floor(it.count) : 1,
        })),
      });
    }
  }

  return NextResponse.json(updated);
}

/* ------------------------------ DELETE (admin) ------------------------------ */
export async function DELETE(_req: Request, ctx: { params: { id: string } }) {
  const { error } = await requireRole(["ADMIN"]);
  if (error) return NextResponse.json(error.json, { status: error.status });

  const id = Number(ctx.params.id);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
