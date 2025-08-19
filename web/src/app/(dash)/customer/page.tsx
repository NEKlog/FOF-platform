// web/src/app/book/page.tsx  (PUBLIC)
const CARDS = [
  { key: "MOVING",    emoji: "📦", title: "Flytning" },
  { key: "FURNITURE", emoji: "🛋️", title: "Møbeltransport" },
  { key: "PARCELS",   emoji: "📬", title: "Pakker < 25 kg" },
  { key: "PALLETS",   emoji: "🧱", title: "Paller & stykgods" },
  { key: "FTL",       emoji: "🚚", title: "Fullload (FTL)" },
] as const;

export default function PublicBookLanding() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Vælg kategori</h1>
      <div className="flex flex-wrap justify-center gap-5">
        {CARDS.map(c => (
          <a
            key={c.key}
            href={`/customer/book?kind=${c.key}`}
            className="w-64 h-40 border rounded-2xl p-4 text-center shadow-sm hover:shadow-md bg-white flex flex-col items-center justify-center"
          >
            <div className="text-5xl">{c.emoji}</div>
            <div className="mt-2 font-semibold text-lg">{c.title}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
