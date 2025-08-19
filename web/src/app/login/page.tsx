"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const sp = useSearchParams();
  const msg = sp.get("m");

 async function submit(e: React.FormEvent) {
  e.preventDefault();
  setErr(null);
  setLoading(true);
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(j?.error ? JSON.stringify(j.error) : `HTTP ${res.status}`);
    }

    // 1) Brug login-svaret direkte
    const role = String(j?.user?.role || "").toUpperCase();

    // 2) Respektér ?next= fra middleware først
    const next = sp.get("next");
    if (next) {
      router.replace(next);
      return;
    }

    // Ellers fald tilbage til rolle-baseret redirect
    if (role === "ADMIN") router.replace("/admin");
    else if (role === "CARRIER") router.replace("/carrier");
    else router.replace("/customer");
  } catch (e: any) {
    setErr(e.message || "Login fejlede");
  } finally {
    setLoading(false);
  }
}


  return (
    <main className="p-6 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Log ind</h1>
      {msg === "forbidden" && <div className="text-red-600">Du har ikke adgang til den side.</div>}
      {msg === "inactive" && <div className="text-red-600">Din konto er ikke aktiv/godkendt.</div>}
      {err && <div className="text-red-600 break-all">{err}</div>}

      <form onSubmit={submit} className="space-y-2">
        <input className="border rounded p-2 w-full" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border rounded p-2 w-full" type="password" placeholder="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button disabled={loading} className="border rounded px-4 py-2">{loading ? "Logger ind…" : "Log ind"}</button>
      </form>
    </main>
  );
}
