import { z } from "zod";
import type { EstadoComida } from "@avante/validators";
import { router, rolesProcedure } from "../trpc";
import { transicionar } from "@/server/comida";

const aux = rolesProcedure("auxiliar", "admin");
const idInput = z.object({ comidaId: z.number().int().positive() });

export const auxiliarRouter = router({
  /** Bandejas del auxiliar: ofrecer/confirmar y luego trasladar/entregar. */
  cola: aux.query(async ({ ctx }) => {
    const comidas = await ctx.prisma.comida_elegida.findMany({
      where: {
        estado: { in: ["ASIGNADA", "EN_OFERTA", "OFERTA_CONFIRMADA", "LISTA", "EN_TRANSITO"] },
      },
      orderBy: { created_at: "asc" },
      include: {
        clientes: { select: { nombre: true, habitacion: true, sede_id: true } },
        dietas: { select: { nombre: true } },
        tiempos: { select: { nombre: true } },
      },
    });
    return comidas
      .filter(
        (c) =>
          ctx.user.sedeId == null ||
          ["admin", "chef_corporativo", "nutricionista"].includes(ctx.user.rol) ||
          c.clientes.sede_id === ctx.user.sedeId,
      )
      .map((c) => ({
        id: c.id,
        estado: c.estado,
        habitacion: c.clientes.habitacion,
        paciente: c.clientes.nombre,
        dieta: c.dietas.nombre,
        tiempo: c.tiempos.nombre,
      }));
  }),

  ofrecer: aux.input(idInput).mutation(async ({ ctx, input }) => {
    await transicionar(ctx.prisma, input.comidaId, "EN_OFERTA", ctx.user.id);
    return { ok: true };
  }),
  confirmar: aux.input(idInput).mutation(async ({ ctx, input }) => {
    await transicionar(ctx.prisma, input.comidaId, "OFERTA_CONFIRMADA", ctx.user.id);
    return { ok: true };
  }),
  enTransito: aux.input(idInput).mutation(async ({ ctx, input }) => {
    await transicionar(ctx.prisma, input.comidaId, "EN_TRANSITO", ctx.user.id);
    return { ok: true };
  }),
  /** Entrega: transición final. El cargo a la cuenta interna se contabiliza aquí. */
  entregar: aux.input(idInput).mutation(async ({ ctx, input }) => {
    const estados: EstadoComida = "ENTREGADA";
    await transicionar(ctx.prisma, input.comidaId, estados, ctx.user.id);
    return { ok: true };
  }),
});
