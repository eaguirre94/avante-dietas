import { z } from "zod";
import { router, rolesProcedure } from "../trpc";
import { transicionar } from "@/server/comida";
import { alimentosProhibidosPaciente } from "@/server/alergias";

const cocina = rolesProcedure("cocinera", "admin");

export const cocinaRouter = router({
  /** Cola del KDS: bandejas confirmadas / en preparación / listas, con aviso de alergia. */
  cola: cocina.query(async ({ ctx }) => {
    const comidas = await ctx.prisma.comida_elegida.findMany({
      where: { estado: { in: ["OFERTA_CONFIRMADA", "EN_PREPARACION", "LISTA"] } },
      orderBy: { updated_at: "asc" },
      include: {
        clientes: { select: { nombre: true, habitacion: true, sede_id: true } },
        dietas: { select: { nombre: true } },
        tiempos: { select: { nombre: true } },
        comida_elegida_linea: {
          where: { excluido_paciente: false },
          include: { platos: { select: { id: true, nombre_normalizado: true } } },
        },
      },
    });

    const result = [];
    for (const c of comidas) {
      // filtro por sede (transversales ven todo)
      if (
        ctx.user.sedeId != null &&
        !["admin", "chef_corporativo", "nutricionista"].includes(ctx.user.rol) &&
        c.clientes.sede_id !== ctx.user.sedeId
      ) {
        continue;
      }
      const prohibidos = await alimentosProhibidosPaciente(ctx.prisma, c.cliente_id);
      const platoIds = c.comida_elegida_linea.map((l) => l.plato_id);
      const pa = platoIds.length
        ? await ctx.prisma.plato_alimento.findMany({
            where: { plato_id: { in: platoIds } },
            select: { plato_id: true, alimento_id: true },
          })
        : [];
      const conflictoPorPlato = new Map<number, boolean>();
      for (const row of pa) {
        if (prohibidos.has(row.alimento_id)) conflictoPorPlato.set(row.plato_id, true);
      }

      result.push({
        id: c.id,
        estado: c.estado,
        habitacion: c.clientes.habitacion,
        paciente: c.clientes.nombre,
        dieta: c.dietas.nombre,
        tiempo: c.tiempos.nombre,
        notas: c.notas_paciente,
        actualizado: c.updated_at,
        lineas: c.comida_elegida_linea.map((l) => ({
          id: l.id,
          plato: l.platos.nombre_normalizado,
          cantidad: l.cantidad,
          conflictoAlergia: conflictoPorPlato.get(l.plato_id) ?? false,
        })),
      });
    }
    return result;
  }),

  enPreparacion: cocina
    .input(z.object({ comidaId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await transicionar(ctx.prisma, input.comidaId, "EN_PREPARACION", ctx.user.id);
      return { ok: true };
    }),

  marcarLista: cocina
    .input(z.object({ comidaId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await transicionar(ctx.prisma, input.comidaId, "LISTA", ctx.user.id);
      return { ok: true };
    }),
});
