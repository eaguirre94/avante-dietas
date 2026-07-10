import { router, protectedProcedure } from "../trpc";
import { alcanceLabel } from "@/server/tenancy";

export const authRouter = router({
  /** Datos del usuario en sesión (para encabezados y guardas de UI). */
  me: protectedProcedure.query(({ ctx }) => ({
    id: ctx.user.id,
    username: ctx.user.username,
    nombre: ctx.user.nombre,
    rol: ctx.user.rol,
    sedeId: ctx.user.sedeId,
    alcance: alcanceLabel(ctx.user),
  })),
});
