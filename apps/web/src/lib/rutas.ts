import type { Rol } from "@avante/validators";

/** Pantalla por defecto según el rol (tras iniciar sesión). */
export function rutaPorRol(rol: Rol): string {
  switch (rol) {
    case "enfermera":
      return "/enfermeria";
    case "auxiliar":
      return "/auxiliar";
    case "cocinera":
      return "/cocina";
    case "nutricionista":
    case "chef_corporativo":
    case "jefe_cocina":
      return "/nutricion";
    case "admin":
    case "doctor":
    default:
      return "/tarifas";
  }
}
