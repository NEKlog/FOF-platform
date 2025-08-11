import NewBid from "./NewBid";
import { headers } from "next/headers";

type Bid = {
  id: number;
  taskId: number;
  carrierId: number;
  amount: number;
  message?: string | null;
  createdAt?: string;
  task?: { id: number; title?: string | null };
  carrier?: { id: number; email?: string | null };
};

export default async function Page() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  const base = `${protocol}://${host}`;

  let bids: Bid[] = [];
  let error = "";

  try {
    const res = await fetch(`${base}/api/bids`, { cache: "no-store" });
    if (!res.ok) {
      error = `API /api/bids returned ${res.status}`;
    } else {
      bids = await res.json();
    }
  } catch (e: any) {
    error = e?.message ?? "Unknown fetch error";
  }

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Seneste bud</h1>
      <NewBid />
      {error ? (
        <div className="text-red-600">Kunne ikke hente bids: {error}</div>
      ) : (
        <ul className="space-y-2">
          {bids.map((b) => (
            <li key={b.id} className="border p-3 rounded-lg">
              <div><b>Task:</b> {b.task?.title ?? b.taskId}</div>
              <div><b>Carrier:</b> {b.carrier?.email ?? b.carrierId}</div>
              <div><b>Amount:</b> {b.amount}</div>
              {b.message ? <div><b>Message:</b> {b.message}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
