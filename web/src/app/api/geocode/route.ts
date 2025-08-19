// web/src/app/api/geocode/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(10, Math.max(1, Number(searchParams.get("limit") ?? 5)));

  if (q.length < 3) {
    return NextResponse.json([], { status: 200 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", q);
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  // (Valgfrit) primære markeder først:
  url.searchParams.set("countrycodes", "dk,se,no,de,pl,nl");

  const res = await fetch(url, {
    headers: {
      // Nominatim kræver en fornuftig UA (brug evt. din email/domæne)
      "User-Agent": "FOF-platform/1.0 (admin@neklog.dk)"
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "geocode_failed", status: res.status }, { status: 502 });
  }

  const rows: any[] = await res.json();
  const out = rows.map(r => ({
    placeId: String(r.place_id),
    label: r.display_name as string,
    lat: Number(r.lat),
    lon: Number(r.lon),
    address: r.address ?? null,
  }));

  return NextResponse.json(out);
}
