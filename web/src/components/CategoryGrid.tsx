// web/src/components/CategoryGrid.tsx
"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

type Cat = {
  code: "MOVING" | "FURNITURE" | "PARCELS" | "PALLETS" | "FTL";
  title: string;
  desc: string;
  img?: string;   // valgfri: /categories/*.svg
  emoji?: string; // fallback hvis der ikke er billede
};

const CATEGORIES: Cat[] = [
  { code: "MOVING",    title: "Flytning",                     desc: "Privat & erhverv",              img: "/categories/moving.svg",    emoji: "🚚" },
  { code: "FURNITURE", title: "Møbeltransport & ukurant",     desc: "Skrøbeligt/enkeltstyks",        img: "/categories/furniture.svg", emoji: "🛋️" },
  { code: "PARCELS",   title: "Pakker & Kurér",               desc: "Sameday/Next day – instant",    img: "/categories/parcels.svg",   emoji: "📦" },
  { code: "PALLETS",   title: "Paller & Stykgods",            desc: "DK – simple zoner/vægt",        img: "/categories/pallets.svg",   emoji: "🧱" },
  { code: "FTL",       title: "Fullloads (FTL)",              desc: "DK/Skandinavien – RFQ",         img: "/categories/ftl.svg",       emoji: "🚛" },
];

export default function CategoryGrid({ hrefBase = "/customer/book" }: { hrefBase?: string }) {
  const router = useRouter();

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-center">Vælg opgavetype</h2>

      {/* 3 + 2 layout (centreret, pæne kort) */}
      <div className="flex flex-wrap justify-center gap-4">
        {CATEGORIES.map((c) => (
          <button
            key={c.code}
            onClick={() => router.push(`${hrefBase}?kind=${c.code}`)}
            className="group w-[220px] h-[150px] rounded-2xl border bg-white shadow-sm hover:shadow-md transition hover:-translate-y-0.5 p-4 text-left"
          >
            <div className="h-16 w-full flex items-center justify-center">
              {c.img ? (
                <Image src={c.img} alt={c.title} width={64} height={64} />
              ) : (
                <span className="text-4xl">{c.emoji}</span>
              )}
            </div>
            <div className="mt-2">
              <div className="font-medium">{c.title}</div>
              <div className="text-xs text-gray-500">{c.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
