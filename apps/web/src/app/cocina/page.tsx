"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { RoleShell } from "@/components/role-shell";

export default function CocinaPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const cola = useQuery(trpc.cocina.cola.queryOptions(undefined, { refetchInterval: 10_000 }));

  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.cocina.cola.queryKey() });
  const enPrep = useMutation(trpc.cocina.enPreparacion.mutationOptions({ onSuccess: invalidate }));
  const lista = useMutation(trpc.cocina.marcarLista.mutationOptions({ onSuccess: invalidate }));

  return (
    <RoleShell title="Cocina — KDS">
      {cola.isLoading && <p className="text-slate-400">Cargando…</p>}
      {cola.data?.length === 0 && <p className="text-slate-400">Sin órdenes en cola.</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cola.data?.map((c) => (
          <div key={c.id} className="rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-2xl text-sky-300">{c.habitacion}</p>
                <p className="text-sm text-white">{c.paciente}</p>
                <p className="text-xs text-slate-400">
                  {c.dieta} · {c.tiempo}
                </p>
              </div>
              <span className="text-xs text-slate-400">{c.estado.toLowerCase().replace("_", " ")}</span>
            </div>
            {c.notas && (
              <p className="mt-2 rounded bg-amber-500/10 p-2 text-sm text-amber-300">📝 {c.notas}</p>
            )}
            <ul className="mt-3 space-y-1 text-sm">
              {c.lineas.map((l) => (
                <li
                  key={l.id}
                  className={l.conflictoAlergia ? "rounded bg-rose-500/10 px-2 py-1" : ""}
                >
                  <span className={l.conflictoAlergia ? "text-slate-500 line-through" : "text-white"}>
                    {l.cantidad ? `${l.cantidad} ` : ""}
                    {l.plato}
                  </span>
                  {l.conflictoAlergia && (
                    <span className="ml-2 text-xs font-bold text-rose-400">⚠ NO PREPARAR — alergia</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              {c.estado === "OFERTA_CONFIRMADA" && (
                <button
                  onClick={() => enPrep.mutate({ comidaId: c.id })}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-slate-900"
                >
                  ▶ En preparación
                </button>
              )}
              {c.estado === "EN_PREPARACION" && (
                <button
                  onClick={() => lista.mutate({ comidaId: c.id })}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white"
                >
                  ✓ Dieta lista
                </button>
              )}
              {c.estado === "LISTA" && (
                <span className="self-center text-sm text-emerald-400">✓ Lista — espera al auxiliar</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </RoleShell>
  );
}
