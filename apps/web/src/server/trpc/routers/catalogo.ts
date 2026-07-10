import { z } from "zod";
import { buscarInput } from "@avante/validators";
import { router, protectedProcedure } from "../trpc";

export const catalogoRouter = router({
  dietas: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.dietas.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, codigo: true, nombre: true, precio_unit: true },
    }),
  ),

  tiempos: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.tiempos.findMany({
      orderBy: { orden: "asc" },
      select: { id: true, codigo: true, nombre: true, es_refrigerio: true },
    }),
  ),

  sedes: protectedProcedure.query(({ ctx }) =>
    ctx.prisma.sedes.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, codigo: true, nombre: true },
    }),
  ),

  /**
   * Buscador de alimentos por nombre (accesible a todo el personal). Marca los
   * alérgenos: es el buscador del modal de captura de alergias — reparado en la
   * v2 porque antes apuntaba a un endpoint inaccesible y forzaba texto libre.
   */
  buscarAlimentos: protectedProcedure.input(buscarInput).query(async ({ ctx, input }) => {
    const q = input.q.trim();
    if (q.length < 2) return [];
    const rows = await ctx.prisma.alimentos.findMany({
      where: {
        activo: true,
        OR: [
          { nombre: { contains: q, mode: "insensitive" } },
          { categoria: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: [{ es_alergeno: "desc" }, { nombre: "asc" }],
      take: input.limit,
      select: { id: true, nombre: true, categoria: true, es_alergeno: true, tipo_alergeno: true },
    });
    return rows.map((a) => ({
      id: a.id,
      nombre: a.nombre,
      grupoAlimentario: a.categoria,
      esAlergeno: a.es_alergeno,
      tipoAlergeno: a.tipo_alergeno,
    }));
  }),

  pacientes: protectedProcedure
    .input(z.object({ soloActivos: z.boolean().default(true) }).optional())
    .query(({ ctx }) =>
      ctx.prisma.clientes.findMany({
        where: {
          activo: true,
          ...(ctx.user.sedeId != null && !["admin", "chef_corporativo", "nutricionista"].includes(ctx.user.rol)
            ? { sede_id: ctx.user.sedeId }
            : {}),
        },
        orderBy: { habitacion: "asc" },
        select: { id: true, nombre: true, habitacion: true, sede_id: true },
      }),
    ),
});
