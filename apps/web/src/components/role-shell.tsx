"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function RoleShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <p className="p-6 text-slate-400">Cargando…</p>;
  }
  if (!session?.user) {
    return (
      <div className="p-6 text-slate-300">
        <p className="mb-3">Sesión no iniciada.</p>
        <Link href="/login" className="text-sky-400 underline">
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-blue-900 to-indigo-950 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-[var(--font-space)] text-lg font-bold text-white">{title}</h1>
          <p className="truncate text-xs text-slate-400">
            {session.user.nombre} · {session.user.rol}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="shrink-0 text-sm text-slate-400 hover:text-white"
        >
          Salir
        </button>
      </header>
      <main className="p-4">{children}</main>
    </div>
  );
}
