import type { EstadoComida } from "@avante/validators";

/**
 * Máquina de estados de la comida (portada del backend v2).
 * ASIGNADA → EN_OFERTA → OFERTA_CONFIRMADA → EN_PREPARACION → LISTA →
 * EN_TRANSITO → ENTREGADA. Cualquier estado no terminal puede ir a CANCELADA.
 */
export const TRANSICIONES_VALIDAS: Record<EstadoComida, EstadoComida[]> = {
  ASIGNADA: ["EN_OFERTA", "CANCELADA"],
  EN_OFERTA: ["OFERTA_CONFIRMADA", "RECHAZADA", "CANCELADA"],
  OFERTA_CONFIRMADA: ["EN_PREPARACION", "CANCELADA"],
  EN_PREPARACION: ["LISTA", "CANCELADA"],
  LISTA: ["EN_TRANSITO", "CANCELADA"],
  EN_TRANSITO: ["ENTREGADA", "CANCELADA"],
  ENTREGADA: [],
  RECHAZADA: [],
  CANCELADA: [],
};

/** Estados "tempranos" (antes de cocina) — una re-indicación puede reemplazarlos. */
export const ESTADOS_TEMPRANOS: EstadoComida[] = [
  "ASIGNADA",
  "EN_OFERTA",
  "OFERTA_CONFIRMADA",
];

export function puedeTransicionar(actual: EstadoComida, siguiente: EstadoComida): boolean {
  return TRANSICIONES_VALIDAS[actual]?.includes(siguiente) ?? false;
}
