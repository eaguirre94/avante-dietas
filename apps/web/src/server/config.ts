/** Configuración derivada de variables de entorno (Módulo de Dietas). */

const bool = (v: string | undefined, def: boolean) =>
  v == null ? def : v === "true" || v === "1";

export const config = {
  /** Offset horario de El Salvador (para "hoy" y ventanas de tiempo). */
  tzOffsetHours: Number(process.env.TIMEZONE_OFFSET_HOURS ?? "-6"),
  /** Precio por defecto de una dieta si no tiene precio propio (USD). */
  cargoPrecioDefault: Number(process.env.CARGO_PRICE_UNIT_DEFAULT ?? "5"),
  /** Detrás de ingress/reverse-proxy = leer X-Forwarded-For. */
  trustForwardedFor: bool(process.env.TRUST_FORWARDED_FOR, true),
} as const;
