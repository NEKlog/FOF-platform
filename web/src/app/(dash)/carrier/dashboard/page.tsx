export default async function CarrierDash() {
  const res = await fetch("http://localhost:3000/api/carrier/earnings", { cache: "no-store" });
  const data = await res.json();
  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Min indtjening</h1>
      <div>Totalt: {data?.totalEarnedDkk?.toFixed?.(2)} kr</div>
      <pre className="bg-gray-100 p-3 rounded text-sm overflow-auto">{JSON.stringify(data?.tasks ?? [], null, 2)}</pre>
    </main>
  );
}
