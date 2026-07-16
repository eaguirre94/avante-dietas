import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PrismaClient, Prisma } from "@avante/db";
import { config } from "@/server/config";
import { ESTADOS_TEMPRANOS } from "@/server/estados";

/**
 * Endpoint interno del ecosistema Avante (server-to-server).
 * El HIS-Frontal crea aquí la ORDEN DE DIETA cuando un médico la indica en su
 * CPOE. Este módulo contiene el contrato (Zod) y la lógica de dominio; el
 * Route Handler en `app/api/interno/orden-dieta/route.ts` solo orquesta.
 *
 * Mapeo al modelo existente (no se inventan tablas):
 *  - Orden de dieta  → `indicacion_medica` (activa, fecha de hoy SV).
 *  - Paciente        → `clientes` (búsqueda por folio Odoo `erp_hospitalizacion_id`,
 *                      partner Odoo `erp_partner_id` o nombre; alta mínima si no existe).
 *  - Alergias        → `paciente_restriccion_alimento` con fuente `EXPEDIENTE_EXTERNO`
 *                      (valor permitido por el CHECK `chk_pac_restr_fuente`); si el texto
 *                      coincide con un alimento del catálogo se registra como
 *                      ('alimento', id) para disparar el bloqueo por grupo Codex,
 *                      si no, como texto libre ('grupo_alimentario', alimento_id=0).
 *  - Bandeja         → `comida_elegida` + líneas, best-effort: solo si hay menú
 *                      vigente y plantilla para dieta/tiempo/día (mismas reglas D3
 *                      que enfermería). Si no se puede, la orden queda igualmente
 *                      registrada y se avisa en `detalles.avisos`.
 */

// ── Contrato ─────────────────────────────────────────────────────────────────
export const ordenDietaInput = z.object({
  modo: z.enum(["ping", "crear"]).default("crear"),
  origen: z.literal("HIS"),
  pacienteNombre: z.string().trim().min(2).max(200),
  pacienteOdooId: z.number().int().positive().optional(),
  citaOdooId: z.number().int().positive().optional(),
  folioOdooId: z.number().int().positive().optional(),
  dieta: z.string().trim().min(1).max(100),
  detalle: z.string().trim().max(2000).optional(),
  alergias: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
  indicadoPor: z.string().trim().min(2).max(150),
  // Extensiones opcionales (el HIS puede omitirlas):
  sedeCodigo: z.string().trim().min(1).max(10).optional(),
  habitacion: z.string().trim().min(1).max(20).optional(),
  tiempoCodigo: z.string().trim().min(1).max(10).optional(),
});
export type OrdenDietaInput = z.infer<typeof ordenDietaInput>;

/** Sede por defecto para pacientes creados por el HIS sin sede explícita. */
const SEDE_DEFAULT = "HE"; // Hospital Especializado (hospitalización)
/** Habitación placeholder cuando el HIS no la manda (columna NOT NULL). */
const HABITACION_DEFAULT = "S/A";

// ── Auth (secreto compartido) ────────────────────────────────────────────────
export type VerificacionToken =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

export function verificarTokenEcosistema(header: string | null): VerificacionToken {
  const esperado = process.env.AVANTE_ECOSISTEMA_TOKEN;
  if (!esperado) {
    return { ok: false, status: 503, error: "integración no configurada" };
  }
  if (!header) return { ok: false, status: 401, error: "token inválido" };
  const a = Buffer.from(header);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "token inválido" };
  }
  return { ok: true };
}

// ── Errores de dominio (→ status HTTP) ──────────────────────────────────────
export class OrdenDietaError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OrdenDietaError";
  }
}

// ── Fechas en hora local de El Salvador ──────────────────────────────────────
function ahoraLocalSV(): { hoy: Date; hora: number; diaSemana: number } {
  const local = new Date(Date.now() + config.tzOffsetHours * 3_600_000);
  const hoy = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  const hora = local.getUTCHours() + local.getUTCMinutes() / 60;
  const diaSemana = local.getUTCDay() === 0 ? 7 : local.getUTCDay(); // 1=lunes … 7=domingo
  return { hoy, hora, diaSemana };
}

/** Próximo tiempo principal según la hora local (D→A→C). */
export function tiempoDefaultCodigo(hora: number): "D" | "A" | "C" {
  if (hora < 10) return "D";
  if (hora < 15) return "A";
  return "C";
}

// ── Resultado ────────────────────────────────────────────────────────────────
export interface ResultadoOrdenDieta {
  ordenId: number;
  detalles: {
    clienteId: number;
    clienteCreado: boolean;
    dieta: { id: number; codigo: string; nombre: string };
    tiempo: { codigo: string; nombre: string };
    fecha: string; // YYYY-MM-DD (hora SV)
    comidaId: number | null;
    bandeja:
      | "CREADA"
      | "SIN_MENU_VIGENTE"
      | "SIN_PLANTILLA_MENU"
      | "NO_CREADA_BANDEJA_EN_COCINA";
    alergiasRegistradas: number;
    avisos: string[];
  };
}

type Tx = Prisma.TransactionClient;

// ── Lógica principal ─────────────────────────────────────────────────────────
export async function crearOrdenDieta(
  prisma: PrismaClient,
  input: OrdenDietaInput,
): Promise<ResultadoOrdenDieta> {
  const { hoy, hora, diaSemana } = ahoraLocalSV();
  const avisos: string[] = [];

  return prisma.$transaction(async (tx: Tx) => {
    // 1. Dieta: por código exacto → nombre exacto → nombre contiene (si es único).
    const dietaTxt = input.dieta.trim();
    let dieta =
      (await tx.dietas.findFirst({
        where: { activo: true, codigo: { equals: dietaTxt, mode: "insensitive" } },
      })) ??
      (await tx.dietas.findFirst({
        where: { activo: true, nombre: { equals: dietaTxt, mode: "insensitive" } },
      }));
    if (!dieta) {
      const candidatas = await tx.dietas.findMany({
        where: { activo: true, nombre: { contains: dietaTxt, mode: "insensitive" } },
        take: 2,
      });
      if (candidatas.length === 1) {
        dieta = candidatas[0]!;
        avisos.push(`Dieta '${dietaTxt}' resuelta por aproximación a '${dieta.nombre}'.`);
      } else if (candidatas.length > 1) {
        throw new OrdenDietaError(
          422,
          `Dieta '${dietaTxt}' es ambigua en el catálogo; enviar el código exacto (p.ej. CORR, BLANDA_HS, DIAB).`,
        );
      } else {
        throw new OrdenDietaError(
          422,
          `Dieta '${dietaTxt}' no existe en el catálogo de dietas activas.`,
        );
      }
    }

    // 2. Tiempo: explícito o el próximo tiempo principal por hora local.
    const tiempoCod = input.tiempoCodigo ?? tiempoDefaultCodigo(hora);
    const tiempo = await tx.tiempos.findFirst({
      where: { codigo: { equals: tiempoCod, mode: "insensitive" } },
    });
    if (!tiempo) {
      throw new OrdenDietaError(422, `Tiempo '${tiempoCod}' no existe (usar D, RAM, A, RPM, C, RNC).`);
    }
    if (!input.tiempoCodigo) {
      avisos.push(`Tiempo asignado automáticamente por hora local: ${tiempo.nombre}.`);
    }

    // 3. Usuario de sistema que firma el registro (la FK enfermera_id es NOT NULL).
    const sistema =
      (await tx.usuarios_dietas.findFirst({
        where: { activo: true, username: "integracion.his" },
      })) ??
      (await tx.usuarios_dietas.findFirst({
        where: { activo: true, rol: "admin" },
        orderBy: { id: "asc" },
      }));
    if (!sistema) {
      throw new OrdenDietaError(
        500,
        "No existe usuario de sistema ('integracion.his' ni admin activo) para firmar la orden.",
      );
    }

    // 4. Paciente: folio Odoo → partner Odoo → nombre → alta mínima.
    let cliente = input.folioOdooId
      ? await tx.clientes.findUnique({
          where: { erp_hospitalizacion_id: input.folioOdooId },
        })
      : null;
    if (!cliente && input.pacienteOdooId) {
      cliente = await tx.clientes.findFirst({
        where: { erp_partner_id: input.pacienteOdooId, activo: true },
        orderBy: { id: "desc" },
      });
    }
    if (!cliente) {
      cliente = await tx.clientes.findFirst({
        where: { activo: true, nombre: { equals: input.pacienteNombre, mode: "insensitive" } },
        orderBy: { id: "desc" },
      });
    }

    let clienteCreado = false;
    if (!cliente) {
      const sedeCod = input.sedeCodigo ?? SEDE_DEFAULT;
      const sede = await tx.sedes.findFirst({
        where: { activo: true, codigo: { equals: sedeCod, mode: "insensitive" } },
      });
      if (!sede) {
        throw new OrdenDietaError(422, `Sede '${sedeCod}' no existe o está inactiva.`);
      }
      cliente = await tx.clientes.create({
        data: {
          nombre: input.pacienteNombre,
          sede_id: sede.id,
          habitacion: input.habitacion ?? HABITACION_DEFAULT,
          fecha_ingreso: hoy,
          erp_hospitalizacion_id: input.folioOdooId ?? null,
          erp_partner_id: input.pacienteOdooId ?? null,
          activo: true,
        },
      });
      clienteCreado = true;
      if (!input.habitacion) {
        avisos.push(
          `Paciente creado sin habitación (placeholder '${HABITACION_DEFAULT}'); enfermería debe asignarla.`,
        );
      }
    } else {
      // Enriquecer la vinculación con Odoo si el HIS trae refs que aún no tenemos.
      const enlace: Record<string, number> = {};
      if (input.folioOdooId && cliente.erp_hospitalizacion_id == null) {
        enlace.erp_hospitalizacion_id = input.folioOdooId;
      }
      if (input.pacienteOdooId && cliente.erp_partner_id == null) {
        enlace.erp_partner_id = input.pacienteOdooId;
      }
      if (Object.keys(enlace).length > 0) {
        cliente = await tx.clientes.update({ where: { id: cliente.id }, data: enlace });
      }
    }

    // 5. Alergias → paciente_restriccion_alimento (fuente EXPEDIENTE_EXTERNO).
    let alergiasRegistradas = 0;
    const vistas = new Set<string>();
    for (const alergiaRaw of input.alergias) {
      const texto = alergiaRaw.trim();
      const clave = texto.toLowerCase();
      if (!texto || vistas.has(clave)) continue;
      vistas.add(clave);

      const match = await tx.alimentos.findFirst({
        where: { activo: true, nombre: { equals: texto, mode: "insensitive" } },
        select: { id: true },
      });
      const tipoAlimento = match ? "alimento" : "grupo_alimentario";
      const alimentoId = match?.id ?? 0; // CHECK: grupo_alimentario exige alimento_id=0
      const grupo = match ? null : texto.slice(0, 40);

      const existente = await tx.paciente_restriccion_alimento.findFirst({
        where: {
          paciente_id: cliente.id,
          activa: true,
          tipo_alimento: tipoAlimento,
          alimento_id: alimentoId,
          ...(grupo ? { grupo_alimentario: { equals: grupo, mode: "insensitive" } } : {}),
        },
      });
      if (existente) continue;

      await tx.paciente_restriccion_alimento.create({
        data: {
          paciente_id: cliente.id,
          tipo_alimento: tipoAlimento,
          alimento_id: alimentoId,
          grupo_alimentario: grupo,
          tipo_restriccion: "ALERGIA",
          severidad: "DESCONOCIDA",
          motivo_clinico: `Reportada por HIS (CPOE) — indicado por ${input.indicadoPor}.`,
          fuente: "EXPEDIENTE_EXTERNO",
          registrado_por_usuario_id: sistema.id,
        },
      });
      alergiasRegistradas++;
    }

    // 6. La ORDEN: indicacion_medica.
    const notas = [
      `[HIS] Indicado por: ${input.indicadoPor}.`,
      input.detalle ? `Detalle: ${input.detalle}` : null,
      input.alergias.length ? `Alergias reportadas por HIS: ${input.alergias.join(", ")}.` : null,
      input.citaOdooId ? `Cita Odoo: ${input.citaOdooId}.` : null,
      input.folioOdooId ? `Folio Odoo: ${input.folioOdooId}.` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const indicacion = await tx.indicacion_medica.create({
      data: {
        cliente_id: cliente.id,
        dieta_id: dieta.id,
        tiempo_id: tiempo.id,
        fecha_aplicacion: hoy,
        enfermera_id: sistema.id,
        indicacion_dr_label: `${input.dieta} — HIS/${input.indicadoPor}`.slice(0, 200),
        notas_clinicas: notas,
        activa: true,
      },
    });

    // 7. Bandeja best-effort (mismas reglas D3 que enfermería.crear).
    let comidaId: number | null = null;
    let bandeja: ResultadoOrdenDieta["detalles"]["bandeja"] = "SIN_MENU_VIGENTE";

    const menu = await tx.menu.findFirst({ where: { estado: "vigente" } });
    if (!menu) {
      avisos.push("No hay menú vigente: la orden quedó registrada sin bandeja.");
    } else {
      const previas = await tx.comida_elegida.findMany({
        where: {
          cliente_id: cliente.id,
          tiempo_id: tiempo.id,
          fecha: { gte: hoy },
          estado: { not: "CANCELADA" },
        },
      });
      const enCocina = previas.some(
        (p) => !ESTADOS_TEMPRANOS.includes(p.estado as (typeof ESTADOS_TEMPRANOS)[number]),
      );
      if (enCocina) {
        bandeja = "NO_CREADA_BANDEJA_EN_COCINA";
        avisos.push(
          `El paciente ya tiene una bandeja de ${tiempo.nombre} en cocina o posterior; la orden quedó registrada y el cambio de bandeja debe gestionarse por el flujo de cambio de dieta.`,
        );
      } else {
        const plantilla = await tx.dieta_tiempo_plato.findMany({
          where: {
            menu_id: menu.id,
            dieta_id: dieta.id,
            tiempo_id: tiempo.id,
            dia_semana: diaSemana,
          },
          orderBy: { orden_plato: "asc" },
        });
        if (plantilla.length === 0) {
          bandeja = "SIN_PLANTILLA_MENU";
          avisos.push(
            `No hay platos en la matriz del menú para ${dieta.codigo}/${tiempo.codigo}/día ${diaSemana}: la orden quedó registrada sin bandeja.`,
          );
        } else {
          for (const p of previas) {
            await tx.comida_elegida.update({
              where: { id: p.id },
              data: { estado: "CANCELADA" },
            });
          }
          const comida = await tx.comida_elegida.create({
            data: {
              uuid: randomUUID(),
              indicacion_id: indicacion.id,
              cliente_id: cliente.id,
              menu_id: menu.id,
              dieta_id: dieta.id,
              tiempo_id: tiempo.id,
              fecha: hoy,
              estado: "ASIGNADA",
            },
          });
          await tx.comida_elegida_linea.createMany({
            data: plantilla.map((it) => ({
              comida_elegida_id: comida.id,
              plato_id: it.plato_id,
              cantidad: it.cantidad,
              orden_plato: it.orden_plato,
              excluido_paciente: false,
            })),
          });
          // Bitácora ('INDICACION_REGISTRADA' es el único valor del CHECK
          // evento_dieta_tipo_evento_check que aplica a la creación).
          await tx.evento_dieta.create({
            data: {
              comida_elegida_id: comida.id,
              tipo_evento: "INDICACION_REGISTRADA",
              estado_nuevo: "ASIGNADA",
              usuario_id: sistema.id,
              payload: {
                origen: input.origen,
                via: "api/interno/orden-dieta",
                indicadoPor: input.indicadoPor,
                citaOdooId: input.citaOdooId ?? null,
                folioOdooId: input.folioOdooId ?? null,
              },
            },
          });
          comidaId = comida.id;
          bandeja = "CREADA";
        }
      }
    }

    return {
      ordenId: indicacion.id,
      detalles: {
        clienteId: cliente.id,
        clienteCreado,
        dieta: { id: dieta.id, codigo: dieta.codigo, nombre: dieta.nombre },
        tiempo: { codigo: tiempo.codigo, nombre: tiempo.nombre },
        fecha: hoy.toISOString().slice(0, 10),
        comidaId,
        bandeja,
        alergiasRegistradas,
        avisos,
      },
    };
  });
}
