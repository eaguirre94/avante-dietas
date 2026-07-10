"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { RoleShell } from "@/components/role-shell";

export default function NutricionPage() {
  const trpc = useTRPC();
  const [q, setQ] = useState("");
  const ings = useQuery(trpc.nutricionista.ingredientes.queryOptions({ q, page: 1, limit: 50 }));

  return (
    <RoleShell title="Nutrición — Catálogo de ingredientes">
      <input
        className="mb-4 w-full max-w-md rounded-lg border border-white/15 bg-black/20 p-2 text-white"
        placeholder="Buscar ingrediente…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-slate-400">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Nombre</th>
              <th className="p-2">Categoría</th>
              <th className="p-2">Alérgeno</th>
            </tr>
          </thead>
          <tbody>
            {ings.data?.items.map((a) => (
              <tr key={a.id} className="border-t border-white/5 text-white">
                <td className="p-2 font-mono text-xs">{a.codigo}</td>
                <td className="p-2">{a.nombre}</td>
                <td className="p-2 text-slate-400">{a.categoria ?? "—"}</td>
                <td className="p-2">
                  {a.es_alergeno ? (
                    <span className="rounded bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-300">
                      {a.tipo_alergeno ?? "sí"}
                    </span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ings.data && <p className="mt-2 text-xs text-slate-500">{ings.data.total} ingredientes</p>}
    </RoleShell>
  );
}
