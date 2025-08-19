export default async function AdminFinancePage() {
  const res = await fetch("http://localhost:3000/api/admin/finance/summary", { cache: "no-store" });
  const data = await res.json();
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Økonomi</h1>
      <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">{JSON.stringify(data, null, 2)}</pre>
    </main>
  );
}
