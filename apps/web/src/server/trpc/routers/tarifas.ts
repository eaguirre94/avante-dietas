import { tarifaUpdateInput } from "@avante/validators";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { config } from "@/server/config";

export const tarifasRouter = router({
  /** Lista de dietas con su precio efectivo (propio o el default). Solo lectura. */
  listar: protectedProcedure.query(async ({ ctx }) => {
    const dietas = await ctx.prisma.dietas.findMany({
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, nombre: true, activo: true, precio_unit: true },
    });
    return dietas.map((d) => ({
      id: d.id,
      codigo: d.codigo,
      nombre: d.nombre,
      activo: d.activo,
      precioUnit: d.precio_unit ? Number(d.precio_unit) : null,
      precioEfectivo: d.precio_unit ? Number(d.precio_unit) : config.cargoPrecioDefault,
    }));
  }),

  /** Solo el administrador modifica precios (decisión de Dirección/Finanzas). */
  actualizar: adminProcedure.input(tarifaUpdateInput).mutation(async ({ ctx, input }) => {
    await ctx.prisma.dietas.update({
      where: { id: input.dietaId },
      data: { precio_unit: input.precioUnit },
    });
    return { ok: true };
  }),
});
