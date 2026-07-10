import { z } from "zod";
import { router, rolesProcedure } from "../trpc";

const nutri = rolesProcedure("nutricionista", "chef_corporativo", "jefe_cocina", "admin");

export const nutricionistaRouter = router({
  /** Catálogo de ingredientes (alimentos) paginado. */
  ingredientes: nutri
    .input(
      z.object({
        q: z.string().max(100).default(""),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const q = input.q.trim();
      const where = q
        ? { nombre: { contains: q, mode: "insensitive" as const } }
        : {};
      const [items, total] = await Promise.all([
        ctx.prisma.alimentos.findMany({
          where,
          orderBy: { codigo: "asc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          select: {
            id: true,
            codigo: true,
            nombre: true,
            categoria: true,
            es_alergeno: true,
            tipo_alergeno: true,
            activo: true,
          },
        }),
        ctx.prisma.alimentos.count({ where }),
      ]);
      return { items, total, page: input.page, limit: input.limit };
    }),
});
