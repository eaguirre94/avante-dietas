import { z } from "zod";
import { alergiaInput } from "@avante/validators";
import { router, rolesProcedure } from "../trpc";

const captura = rolesProcedure("auxiliar", "enfermera", "doctor", "admin");

const FUENTE_POR_ROL: Record<string, string> = {
  auxiliar: "PACIENTE_VIA_AUXILIAR",
  enfermera: "PACIENTE_VIA_ENFERMERA",
  doctor: "DOCTOR",
  admin: "DOCTOR",
};

export const alergiasRouter = router({
  listar: captura
    .input(z.object({ pacienteId: z.number().int().positive() }))
    .query(({ ctx, input }) =>
      ctx.prisma.paciente_restriccion_alimento.findMany({
        where: { paciente_id: input.pacienteId, activa: true },
        orderBy: { registrado_at: "desc" },
      }),
    ),

  /**
   * Crear alergia. RED DE SEGURIDAD (v2): si llega como texto libre
   * (grupo_alimentario) pero coincide con el nombre exacto de un alimento del
   * catálogo, se RESUELVE a ('alimento', id) para que dispare el bloqueo por
   * grupo Codex — aunque el usuario no lo eligiera de la lista.
   */
  crear: captura.input(alergiaInput).mutation(async ({ ctx, input }) => {
    let tipoAlimento = input.tipoAlimento;
    let alimentoId = input.alimentoId;
    let grupo = input.grupoAlimentario ?? null;

    if (tipoAlimento === "grupo_alimentario" && grupo) {
      const match = await ctx.prisma.alimentos.findFirst({
        where: { activo: true, nombre: { equals: grupo.trim(), mode: "insensitive" } },
        select: { id: true },
      });
      if (match) {
        tipoAlimento = "alimento";
        alimentoId = match.id;
        grupo = null;
      }
    }

    return ctx.prisma.paciente_restriccion_alimento.create({
      data: {
        paciente_id: input.pacienteId,
        tipo_alimento: tipoAlimento,
        alimento_id: alimentoId,
        grupo_alimentario: grupo,
        tipo_restriccion: input.tipoRestriccion,
        severidad: input.severidad,
        motivo_clinico: input.motivoClinico ?? null,
        fuente: FUENTE_POR_ROL[ctx.user.rol] ?? "DOCTOR",
        registrado_por_usuario_id: ctx.user.id,
      },
    });
  }),
});
