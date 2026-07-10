import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma, verifyPassword } from "@avante/db";
import { loginInput, rolSchema, type Rol } from "@avante/validators";

/**
 * Auth.js (NextAuth v5) — login del personal contra `usuarios_dietas`
 * (bcrypt, compatible con los hashes existentes). Estrategia JWT.
 * Provider futuro recomendado: Microsoft Entra ID (SSO M365 del hospital).
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Avante Dietas",
      credentials: { username: {}, password: {} },
      authorize: async (raw) => {
        const parsed = loginInput.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;
        const u = await prisma.usuarios_dietas.findUnique({ where: { username } });
        if (!u || !u.activo) return null;
        if (!verifyPassword(password, u.password_hash)) return null;
        const rol = rolSchema.safeParse(u.rol);
        if (!rol.success) return null;
        return {
          id: String(u.id),
          name: u.nombre_completo,
          username: u.username,
          nombre: u.nombre_completo,
          rol: rol.data,
          sedeId: u.sede_id ?? null,
        };
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.uid = Number(user.id);
        token.username = user.username;
        token.nombre = user.nombre;
        token.rol = user.rol;
        token.sedeId = user.sedeId;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.id = String(token.uid ?? "");
        session.user.username = token.username as string;
        session.user.nombre = token.nombre as string;
        session.user.rol = token.rol as Rol;
        session.user.sedeId = (token.sedeId as number | null) ?? null;
      }
      return session;
    },
  },
});
