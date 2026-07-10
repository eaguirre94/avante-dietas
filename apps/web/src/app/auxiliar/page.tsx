"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { RoleShell } from "@/components/role-shell";

export default function AuxiliarPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const cola = useQuery(trpc.auxiliar.cola.queryOptions(undefined, { refetchInterval: 10_000 }));
  const invalidate = () => qc.invalidateQueries({ queryKey: trpc.auxiliar.cola.queryKey() });

  const ofrecer = useMutation(trpc.auxiliar.ofrecer.mutationOptions({ onSuccess: invalidate }));
  const confirmar = useMutation(trpc.auxiliar.confirmar.mutationOptions({ onSuccess: invalidate }));
  const enTransito = useMutation(trpc.auxiliar.enTransito.mutationOptions({ onSuccess: invalidate }));
  const entregar = useMutation(trpc.auxiliar.entregar.mutationOptions({ onSuccess: invalidate }));

  return (
    <RoleShell title="Auxiliar — Bandejas">
      {cola.isLoading && <p className="text-slate-400">Cargando…</p>}
      {cola.data?.length === 0 && <p className="text-slate-400">Sin bandejas pendientes.</p>}
      <div className="space-y-2">
        {cola.data?.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
          >
            <div>
              <span className="font-mono text-lg text-sky-300">{c.habitacion}</span>
              <span className="ml-2 text-sm text-white">{c.paciente}</span>
              <p className="text-xs text-slate-400">
                {c.dieta} · {c.tiempo} · {c.estado.toLowerCase().replace(/_/g, " ")}
              </p>
            </div>
            <div className="flex gap-2">
              {c.estado === "ASIGNADA" && (
                <button onClick={() => ofrecer.mutate({ comidaId: c.id })} className="btn">Ofrecer</button>
              )}
              {c.estado === "EN_OFERTA" && (
                <button onClick={() => confirmar.mutate({ comidaId: c.id })} className="btn">Confirmar</button>
              )}
              {c.estado === "LISTA" && (
                <button onClick={() => enTransito.mutate({ comidaId: c.id })} className="btn">En tránsito</button>
              )}
              {c.estado === "EN_TRANSITO" && (
                <button onClick={() => entregar.mutate({ comidaId: c.id })} className="btn">Entregar</button>
              )}
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        .btn {
          border-radius: 0.5rem;
          background: linear-gradient(120deg, #0284c7, #1e3a8a);
          padding: 0.5rem 0.9rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: white;
        }
      `}</style>
    </RoleShell>
  );
}
