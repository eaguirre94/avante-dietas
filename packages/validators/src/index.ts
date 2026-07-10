// Contrato único cliente/servidor (Zod 4) — Módulo de Dietas Hospitalarias.
import { z } from "zod";

// ── Roles ────────────────────────────────────────────────────────────────────
export const ROLES = [
  "doctor",
  "enfermera",
  "auxiliar",
  "cocinera",
  "admin",
  "nutricionista",
  "chef_corporativo",
  "jefe_cocina",
] as const;
export type Rol = (typeof ROLES)[number];
export const rolSchema = z.enum(ROLES);

/** Roles transversales (ven todas las sedes; sede_id NULL). */
export const ROLES_TRANSVERSALES: Rol[] = ["admin", "chef_corporativo", "nutricionista"];
export const esTransversal = (rol: Rol) => ROLES_TRANSVERSALES.includes(rol);

// ── Estados de la comida (máquina de estados) ────────────────────────────────
export const ESTADOS_COMIDA = [
  "ASIGNADA",
  "EN_OFERTA",
  "OFERTA_CONFIRMADA",
  "EN_PREPARACION",
  "LISTA",
  "EN_TRANSITO",
  "ENTREGADA",
  "RECHAZADA",
  "CANCELADA",
] as const;
export type EstadoComida = (typeof ESTADOS_COMIDA)[number];

// ── 14 alérgenos Codex ───────────────────────────────────────────────────────
export const ALERGENOS_CODEX = [
  "GLUTEN", "CRUSTACEOS", "HUEVO", "PESCADO", "MANI", "SOYA", "LACTOSA",
  "FRUTOS_SECOS", "APIO", "MOSTAZA", "AJONJOLI", "SULFITOS", "ALTRAMUCES", "MOLUSCOS",
] as const;

export const SEVERIDADES = ["LEVE", "MODERADA", "SEVERA", "ANAFILACTICA", "DESCONOCIDA"] as const;
export type Severidad = (typeof SEVERIDADES)[number];

// ── Inputs (contrato) ────────────────────────────────────────────────────────
export const loginInput = z.object({
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
});
export type LoginInput = z.infer<typeof loginInput>;

export const indicacionInput = z.object({
  habitacionCodigo: z.string().min(1),
  pacienteNombre: z.string().min(2),
  pacienteDocumento: z.string().nullable().optional(),
  dietaCodigo: z.string().min(1),
  tiempoCodigo: z.string().min(1),
  diaSemana: z.number().int().min(1).max(7),
  indicacionDr: z.string().default(""),
  notas: z.string().nullable().optional(),
});
export type IndicacionInput = z.infer<typeof indicacionInput>;

export const cambiarEstadoInput = z.object({
  comidaId: z.number().int().positive(),
  nuevoEstado: z.enum(ESTADOS_COMIDA),
});

export const alergiaInput = z.object({
  pacienteId: z.number().int().positive(),
  tipoAlimento: z.enum(["alimento", "fruta", "grupo_alimentario"]),
  alimentoId: z.number().int().min(0),
  grupoAlimentario: z.string().nullable().optional(),
  tipoRestriccion: z
    .enum(["ALERGIA", "INTOLERANCIA", "PREFERENCIA_PERMANENTE"])
    .default("ALERGIA"),
  severidad: z.enum(SEVERIDADES).default("MODERADA"),
  motivoClinico: z.string().nullable().optional(),
});
export type AlergiaInput = z.infer<typeof alergiaInput>;

export const tarifaUpdateInput = z.object({
  dietaId: z.number().int().positive(),
  precioUnit: z.number().min(0).nullable(),
});

export const buscarInput = z.object({
  q: z.string().max(100).default(""),
  limit: z.number().int().min(1).max(30).default(12),
});

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Normaliza texto para comparar (minúsculas, sin espacios extra). */
export function normalizar(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
