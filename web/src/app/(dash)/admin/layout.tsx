import Link from "next/link";
import ImpersonateSwitcher from "./ImpersonateSwitcher";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto p-3 flex items-center gap-3">
          <Link href="/admin" className="font-semibold">Admin</Link>
          <nav className="flex gap-3 text-sm">
            <Link href="/admin/users" className="underline-offset-2 hover:underline">Brugere</Link>
            <Link href="/admin/kanban" className="underline-offset-2 hover:underline">Kanban</Link>
            <Link href="/admin/assign" className="underline-offset-2 hover:underline">Tildel</Link>
            {/* Midlertidige direkte links */}
            <Link href="/customer" className="underline-offset-2 hover:underline">Customer UI</Link>
            <Link href="/carrier" className="underline-offset-2 hover:underline">Carrier UI</Link>
          </nav>
          <div className="ml-auto">
            <ImpersonateSwitcher />
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto p-4">{children}</div>
    </div>
  );
}
