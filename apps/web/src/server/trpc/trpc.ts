import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Rol } from "@avante/validators";
import { prisma } from "@avante/db";
import { auth } from "@/server/auth";
import type { SessionUser } from "@/server/tenancy";

/** Contexto por petición: sesión del personal + cliente Prisma. */
export async function createTRPCContext(opts: { headers: Headers }) {
  const session = await auth();
  return { session, prisma, headers: opts.headers };
}
export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zod: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const router = t.router;
export const publicProcedure = t.procedure;

/** Requiere sesión válida. Inyecta el usuario tipado en el ctx. */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Inicia sesión." });
  }
  const s = ctx.session.user;
  const user: SessionUser = {
    id: Number(s.id),
    username: s.username,
    nombre: s.nombre,
    rol: s.rol,
    sedeId: s.sedeId,
  };
  return next({ ctx: { ...ctx, user } });
});

/** Restringe a un conjunto de roles. */
export function rolesProcedure(...roles: Rol[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!roles.includes(ctx.user.rol)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requiere uno de los roles: ${roles.join(", ")}.`,
      });
    }
    return next({ ctx });
  });
}

export const adminProcedure = rolesProcedure("admin");
