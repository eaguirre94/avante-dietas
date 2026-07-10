import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { indicacionInput } from "@avante/validators";
import { router, rolesProcedure } from "../trpc";
import { ESTADOS_TEMPRANOS } from "@/server/estados";

const enf = rolesProcedure("enfermera", "admin");

function hoyFecha(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const enfermeriaRouter = router({
  indicacionesHoy: enf.query(async ({ ctx }) => {
    const comidas = await ctx.prisma.comida_elegida.findMany({
      where: { fecha: { gte: hoyFecha() }, estado: { not: "CANCELADA" } },
      orderBy: { created_at: "desc" },
      include: {
        clientes: { select: { nombre: true, habitacion: true, sede_id: true } },
        dietas: { select: { nombre: true, codigo: true } },
        tiempos: { select: { nombre: true } },
      },
    });
    return comidas
      .filter(
        (c) =>
          ctx.user.sedeId == null ||
          ctx.user.rol === "admin" ||
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

  /** Crea indicación → paciente (upsert) → comida (ASIGNADA) → líneas del menú.
   *  D3: si el paciente ya tiene bandeja para ese tiempo hoy, reemplaza si está
   *  temprana; bloquea (409) si ya está en cocina o más. */
  crear: enf.input(indicacionInput).mutation(async ({ ctx, input }) => {
    return ctx.prisma.$transaction(async (tx) => {
      // 1. Habitación válida (en la sede del usuario, o cualquiera si transversal)
      const qr = await tx.qr_habitacion.findFirst({
        where: {
          habitacion: input.habitacionCodigo,
          activo: true,
          ...(ctx.user.sedeId != null && ctx.user.rol !== "admin"
            ? { sede_id: ctx.user.sedeId }
            : {}),
        },
      });
      if (!qr) throw new TRPCError({ code: "NOT_FOUND", message: "Habitación inválida." });
      const sedeId = qr.sede_id;

      // 2. Catálogos
      const dieta = await tx.dietas.findFirst({
        where: { codigo: input.dietaCodigo, activo: true },
      });
      if (!dieta) throw new TRPCError({ code: "BAD_REQUEST", message: "Dieta inválida." });
      const tiempo = await tx.tiempos.findFirst({ where: { codigo: input.tiempoCodigo } });
      if (!tiempo) throw new TRPCError({ code: "BAD_REQUEST", message: "Tiempo inválido." });
      const menu = await tx.menu.findFirst({ where: { estado: "vigente" } });
      if (!menu) throw new TRPCError({ code: "BAD_REQUEST", message: "No hay menú vigente." });

      // 3. Upsert paciente
      let cliente =
        (input.pacienteDocumento
          ? await tx.clientes.findFirst({
              where: { documento: input.pacienteDocumento, activo: true },
            })
          : null) ??
        (await tx.clientes.findFirst({
          where: {
            sede_id: sedeId,
            habitacion: input.habitacionCodigo,
            nombre: { equals: input.pacienteNombre, mode: "insensitive" },
            activo: true,
          },
        }));
      if (!cliente) {
        cliente = await tx.clientes.create({
          data: {
            nombre: input.pacienteNombre,
            documento: input.pacienteDocumento ?? null,
            sede_id: sedeId,
            habitacion: input.habitacionCodigo,
            fecha_ingreso: hoyFecha(),
            activo: true,
          },
        });
      } else if (cliente.habitacion !== input.habitacionCodigo) {
        await tx.clientes.update({
          where: { id: cliente.id },
          data: { habitacion: input.habitacionCodigo },
        });
      }

      // 4. D3 — evitar bandeja duplicada del mismo tiempo hoy
      const previas = await tx.comida_elegida.findMany({
        where: {
          cliente_id: cliente.id,
          tiempo_id: tiempo.id,
          fecha: { gte: hoyFecha() },
          estado: { not: "CANCELADA" },
        },
      });
      for (const p of previas) {
        if (!ESTADOS_TEMPRANOS.includes(p.estado as (typeof ESTADOS_TEMPRANOS)[number])) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `El paciente ya tiene una dieta para ${tiempo.nombre} en '${p.estado}' (ya en cocina). Usa el flujo de cambio de dieta.`,
          });
        }
      }
      for (const p of previas) {
        await tx.comida_elegida.update({ where: { id: p.id }, data: { estado: "CANCELADA" } });
      }

      // 5. Indicación + comida
      const indicacion = await tx.indicacion_medica.create({
        data: {
          cliente_id: cliente.id,
          dieta_id: dieta.id,
          tiempo_id: tiempo.id,
          fecha_aplicacion: hoyFecha(),
          enfermera_id: ctx.user.id,
          indicacion_dr_label: input.indicacionDr || null,
          notas_clinicas: input.notas ?? null,
          activa: true,
        },
      });
      const comida = await tx.comida_elegida.create({
        data: {
          uuid: randomUUID(),
          indicacion_id: indicacion.id,
          cliente_id: cliente.id,
          menu_id: menu.id,
          dieta_id: dieta.id,
          tiempo_id: tiempo.id,
          fecha: hoyFecha(),
          estado: "ASIGNADA",
        },
      });

      // 6. Líneas desde la matriz dieta_tiempo_plato
      const plantilla = await tx.dieta_tiempo_plato.findMany({
        where: {
          menu_id: menu.id,
          dieta_id: dieta.id,
          tiempo_id: tiempo.id,
          dia_semana: input.diaSemana,
        },
        orderBy: { orden_plato: "asc" },
      });
      if (plantilla.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No hay platos en la matriz para esa dieta/tiempo/día.",
        });
      }
      await tx.comida_elegida_linea.createMany({
        data: plantilla.map((it) => ({
          comida_elegida_id: comida.id,
          plato_id: it.plato_id,
          cantidad: it.cantidad,
          orden_plato: it.orden_plato,
          excluido_paciente: false,
        })),
      });

      return { comidaId: comida.id, clienteId: cliente.id, estado: comida.estado };
    });
  }),
});
