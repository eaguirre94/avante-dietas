import type { Rol } from "@avante/validators";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      username: string;
      nombre: string;
      rol: Rol;
      sedeId: number | null;
    };
  }
  interface User {
    username: string;
    nombre: string;
    rol: Rol;
    sedeId: number | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: number;
    username: string;
    nombre: string;
    rol: Rol;
    sedeId: number | null;
  }
}
