"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useTRPC } from "@/lib/trpc/react";
import { RoleShell } from "@/components/role-shell";

export default function TarifasPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = session?.user?.rol === "admin";
  const tarifas = useQuery(trpc.tarifas.listar.queryOptions());
  const [edits, setEdits] = useState<Record<number, string>>({});

  const actualizar = useMutation(
    trpc.tarifas.actualizar.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: trpc.tarifas.listar.queryKey() }),
    }),
  );

  return (
    <RoleShell title="Tarifas de dietas">
      {!isAdmin && (
        <p className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
          Vista de solo lectura. Solo Administración modifica los precios.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-slate-400">
            <tr>
              <th className="p-2">Código</th>
              <th className="p-2">Nombre</th>
              <th className="p-2 text-right">Precio efectivo</th>
              {isAdmin && <th className="p-2 text-right">Editar</th>}
            </tr>
          </thead>
          <tbody>
            {tarifas.data?.map((t) => (
              <tr key={t.id} className="border-t border-white/5 text-white">
                <td className="p-2 font-mono">{t.codigo}</td>
                <td className="p-2">{t.nombre}</td>
                <td className="p-2 text-right font-mono">${t.precioEfectivo.toFixed(2)}</td>
                {isAdmin && (
                  <td className="p-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      className="w-20 rounded border border-white/15 bg-black/20 p-1 text-right text-white"
                      placeholder={String(t.precioUnit ?? "")}
                      value={edits[t.id] ?? ""}
                      onChange={(e) => setEdits((p) => ({ ...p, [t.id]: e.target.value }))}
                    />
                    <button
                      className="ml-2 rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white"
                      onClick={() =>
                        actualizar.mutate({
                          dietaId: t.id,
                          precioUnit: edits[t.id] ? Number(edits[t.id]) : null,
                        })
                      }
                    >
                      Guardar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </RoleShell>
  );
}
