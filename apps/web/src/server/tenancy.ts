import type { Rol } from "@avante/validators";
import { esTransversal } from "@avante/validators";

export type SessionUser = {
  id: number;
  username: string;
  nombre: string;
  rol: Rol;
  sedeId: number | null;
};

/**
 * Filtro de sede: los roles transversales (admin/chef_corp/nutricionista) ven
 * todas las sedes; los demás quedan acotados a la suya. Devuelve `undefined`
 * (sin filtro) para transversales, o `{ sede_id }` para el resto.
 */
export function sedeFilter(user: SessionUser): { sede_id: number } | undefined {
  if (esTransversal(user.rol) || user.sedeId == null) return undefined;
  return { sede_id: user.sedeId };
}

/** ¿La sede dada cae dentro del alcance del usuario? */
export function sedeEnAlcance(user: SessionUser, sedeId: number | null): boolean {
  if (esTransversal(user.rol) || user.sedeId == null) return true;
  return sedeId === user.sedeId;
}

export function alcanceLabel(user: SessionUser): string {
  return esTransversal(user.rol) ? "Todas las sedes" : `Sede ${user.sedeId ?? "—"}`;
}
