import { prisma } from "@/lib/db";
import AdminUsersClient from "./users.client";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  // simple rolliste — kan hentes dynamisk senere
  const roles = ["ADMIN", "CUSTOMER", "CARRIER"];

  // hent brugere (server-side filtrering kan bygges på senere)
  const rawUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      approved: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // SERIALISÉR Date -> string så klienten nemt kan render’e
  const users = rawUsers.map(u => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Admin · Brugere</h1>
      <AdminUsersClient initial={{ roles, users }} />
    </main>
  );
}
