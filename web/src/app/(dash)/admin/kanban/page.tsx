import { headers } from "next/headers";
import KanbanClient from "./KanbanClient";

export default async function AdminKanbanPage() {
  const h = await headers();

  // Byg base-URL + videresend cookies, så auth/middleware virker
  const host = h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "development" ? "http" : "https");
  const base = `${proto}://${host}`;
  const cookie = h.get("cookie") ?? "";

  const res = await fetch(`${base}/api/admin/tasks?page=1&pageSize=200`, {
    cache: "no-store",
    // kritisk for at undgå HTML-redirect til /login:
    headers: { cookie },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `API /api/admin/tasks returned ${res.status}: ${text.slice(0, 200)}…`
    );
  }

  const data = await res.json();

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin · Kanban</h1>
      <KanbanClient initial={data} />
    </main>
  );
}
