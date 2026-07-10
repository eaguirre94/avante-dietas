"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { RoleShell } from "@/components/role-shell";

export default function EnfermeriaPage() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const hoy = useQuery(trpc.enfermeria.indicacionesHoy.queryOptions());
  const dietas = useQuery(trpc.catalogo.dietas.queryOptions());
  const tiempos = useQuery(trpc.catalogo.tiempos.queryOptions());

  const [habitacion, setHabitacion] = useState("");
  const [paciente, setPaciente] = useState("");
  const [dietaCodigo, setDietaCodigo] = useState("");
  const [tiempoCodigo, setTiempoCodigo] = useState("");
  const [msg, setMsg] = useState("");

  const crear = useMutation(
    trpc.enfermeria.crear.mutationOptions({
      onSuccess: () => {
        setMsg("✓ Indicación creada");
        setPaciente("");
        qc.invalidateQueries({ queryKey: trpc.enfermeria.indicacionesHoy.queryKey() });
      },
      onError: (e) => setMsg(e.message),
    }),
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    crear.mutate({
      habitacionCodigo: habitacion,
      pacienteNombre: paciente,
      pacienteDocumento: null,
      dietaCodigo,
      tiempoCodigo,
      diaSemana: ((new Date().getDay() + 6) % 7) + 1, // 1=lunes..7=domingo
      indicacionDr: "",
      notas: null,
    });
  }

  return (
    <RoleShell title="Enfermería — Indicación de dieta">
      <form onSubmit={onSubmit} className="mb-6 grid max-w-2xl grid-cols-1 gap-3 rounded-lg border border-white/10 bg-white/5 p-4 md:grid-cols-2">
        <input className="inp" placeholder="Habitación (ej. 005)" value={habitacion} onChange={(e) => setHabitacion(e.target.value)} required />
        <input className="inp" placeholder="Nombre del paciente" value={paciente} onChange={(e) => setPaciente(e.target.value)} required />
        <select className="inp" value={dietaCodigo} onChange={(e) => setDietaCodigo(e.target.value)} required>
          <option value="">— Dieta —</option>
          {dietas.data?.map((d) => (
            <option key={d.id} value={d.codigo}>{d.nombre}</option>
          ))}
        </select>
        <select className="inp" value={tiempoCodigo} onChange={(e) => setTiempoCodigo(e.target.value)} required>
          <option value="">— Tiempo —</option>
          {tiempos.data?.map((t) => (
            <option key={t.id} value={t.codigo}>{t.nombre}</option>
          ))}
        </select>
        <button type="submit" disabled={crear.isPending} className="md:col-span-2 rounded-lg bg-sky-600 py-2 font-semibold text-white disabled:opacity-50">
          {crear.isPending ? "Creando…" : "Crear indicación"}
        </button>
        {msg && <p className="md:col-span-2 text-sm text-slate-200">{msg}</p>}
      </form>

      <h2 className="mb-2 text-xs uppercase tracking-widest text-slate-400">Indicaciones de hoy</h2>
      <div className="space-y-2">
        {hoy.data?.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded border border-white/10 bg-white/5 p-2 text-sm">
            <span><span className="font-mono text-sky-300">{c.habitacion}</span> · {c.paciente}</span>
            <span className="text-slate-400">{c.dieta} · {c.tiempo} · {c.estado.toLowerCase()}</span>
          </div>
        ))}
        {hoy.data?.length === 0 && <p className="text-slate-400">Sin indicaciones hoy.</p>}
      </div>
      <style jsx>{`
        .inp {
          border-radius: 0.5rem;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: rgba(0, 0, 0, 0.2);
          padding: 0.6rem;
          color: white;
        }
      `}</style>
    </RoleShell>
  );
}
