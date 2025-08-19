import { NextResponse } from "next/server";
import { z } from "zod";
import { BookingCategory } from "@prisma/client";

const QuoteSchema = z.object({
  category: z.nativeEnum(BookingCategory),
  origin: z.string().min(5),
  dest: z.string().min(5),
  details: z.any().optional()
});

export async function POST(req: Request) {
  const p = QuoteSchema.safeParse(await req.json().catch(()=> ({})));
  if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 });

  const { category } = p.data;
  let price = 399;
  if (category === "PARCEL") price = 149;
  if (category === "PALLET_LTL") price = 499;
  if (category === "FREIGHT") price = 1999;
  return NextResponse.json({ price, currency: "DKK" });
}