import type { PrismaClient } from "@avante/db";

/**
 * Motor de alergias (portado de filtro_alergias.py). Devuelve el conjunto de
 * IDs de alimentos PROHIBIDOS para un paciente, cruzando sus restricciones:
 *  - grupo_alimentario → todos los alimentos cuya `categoria` coincide.
 *  - alimento/fruta con ALERGIA/INTOLERANCIA → se EXPANDE a todo el grupo Codex
 *    (mismo `tipo_alergeno`). Un alérgico a la leche evita todos los lácteos.
 * (Bug clínico corregido en la v2: antes cruzaba por id exacto y ofrecía la
 *  Cuajada en silencio a un alérgico a la leche.)
 */
export async function alimentosProhibidosPaciente(
  prisma: PrismaClient,
  pacienteId: number,
): Promise<Set<number>> {
  const prohibidos = new Set<number>();

  const restricciones = await prisma.paciente_restriccion_alimento.findMany({
    where: { paciente_id: pacienteId, activa: true, contradicha: false },
  });

  for (const r of restricciones) {
    if (r.tipo_alimento === "grupo_alimentario") {
      const grupo = (r.grupo_alimentario ?? "").trim().toLowerCase();
      if (grupo) {
        const delGrupo = await prisma.alimentos.findMany({
          where: { activo: true, categoria: { equals: grupo, mode: "insensitive" } },
          select: { id: true },
        });
        for (const a of delGrupo) prohibidos.add(a.id);
      }
    } else if (r.alimento_id > 0) {
      prohibidos.add(r.alimento_id);
      if (r.tipo_restriccion === "ALERGIA" || r.tipo_restriccion === "INTOLERANCIA") {
        for (const id of await expandirPorTipoAlergeno(prisma, r.alimento_id)) {
          prohibidos.add(id);
        }
      }
    }
  }
  return prohibidos;
}

/** Si el alimento es alérgeno, devuelve TODOS los alimentos activos del mismo grupo Codex. */
async function expandirPorTipoAlergeno(
  prisma: PrismaClient,
  alimentoId: number,
): Promise<number[]> {
  const base = await prisma.alimentos.findFirst({
    where: { id: alimentoId, es_alergeno: true },
    select: { tipo_alergeno: true },
  });
  if (!base?.tipo_alergeno) return [];
  const grupo = await prisma.alimentos.findMany({
    where: { activo: true, es_alergeno: true, tipo_alergeno: base.tipo_alergeno },
    select: { id: true },
  });
  return grupo.map((a) => a.id);
}
