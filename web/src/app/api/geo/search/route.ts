// web/src/app/api/geo/search/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const limit = Math.min(10, Math.max(1, Number(searchParams.get("limit") || 5)));
  const country = (searchParams.get("country") || "dk").toLowerCase();

  if (!q) return NextResponse.json([]);

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("countrycodes", country);
  url.searchParams.set("dedupe", "1");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "FOF-Platform/1.0 (contact@example.com)", // <- udskift med jeres kontakt
      "Accept-Language": "da,en",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: `Nominatim ${res.status}` }, { status: 502 });
  }

  const raw = await res.json();
  const items = (Array.isArray(raw) ? raw : []).map((r: any) => ({
    label: r.display_name as string,
    lat: Number(r.lat),
    lon: Number(r.lon),
    city: r.address?.city || r.address?.town || r.address?.village || null,
    postcode: r.address?.postcode || null,
    road: r.address?.road || null,
    house_number: r.address?.house_number || null,
  }));

  return NextResponse.json(items);
}
