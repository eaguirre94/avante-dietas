import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@avante/db";
import type { EstadoComida } from "@avante/validators";
import { puedeTransicionar } from "./estados";

/**
 * Transición de estado de una comida con validación de la máquina de estados.
 * Asigna auxiliar/cocinera según el estado destino y deja bitácora en
 * `evento_dieta`.
 */
export async function transicionar(
  prisma: PrismaClient,
  comidaId: number,
  nuevo: EstadoComida,
  usuarioId: number,
): Promise<void> {
  const comida = await prisma.comida_elegida.findUnique({ where: { id: comidaId } });
  if (!comida) throw new TRPCError({ code: "NOT_FOUND", message: "Comida no encontrada." });
  const actual = comida.estado as EstadoComida;
  if (!puedeTransicionar(actual, nuevo)) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Transición inválida ${actual} → ${nuevo}.`,
    });
  }

  const data: Record<string, unknown> = { estado: nuevo, updated_at: new Date() };
  if (nuevo === "EN_OFERTA" || nuevo === "EN_TRANSITO") data.auxiliar_id = usuarioId;
  if (nuevo === "EN_PREPARACION" || nuevo === "LISTA") data.cocinera_id = usuarioId;

  await prisma.comida_elegida.update({ where: { id: comidaId }, data });

  await prisma.evento_dieta
    .create({
      data: {
        comida_elegida_id: comidaId,
        tipo_evento: "CAMBIO_ESTADO",
        estado_anterior: actual,
        estado_nuevo: nuevo,
        usuario_id: usuarioId,
      },
    })
    .catch(() => undefined); // la bitácora nunca debe romper la transición
}
