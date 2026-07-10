import bcrypt from "bcryptjs";

/**
 * Hash de contraseñas compatible 1:1 con la app v1 (Python/passlib):
 * formato bcrypt `$2b$12$...` (60 chars). Así los usuarios existentes de
 * `usuarios_dietas` inician sesión sin cambiar su clave.
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    if (!stored) return false;
    return bcrypt.compareSync(password, stored);
  } catch {
    return false;
  }
}
