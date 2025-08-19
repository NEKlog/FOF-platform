// src/app/(dash)/admin/tasks/page.tsx
import AdminTasksManager from "./_components/AdminTasksManager";
export default function Page() {
  return (
    <main className="mx-auto max-w-7xl p-4">
      <h1 className="text-2xl font-semibold mb-4">Opgaver (Admin)</h1>
      <AdminTasksManager />
    </main>
  );
}
