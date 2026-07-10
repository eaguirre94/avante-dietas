import { describe, it, expect } from "vitest";
import {
  ROLES,
  esTransversal,
  loginInput,
  alergiaInput,
  normalizar,
  ALERGENOS_CODEX,
} from "./index";

describe("contrato de dietas", () => {
  it("los roles transversales no tienen sede", () => {
    expect(esTransversal("admin")).toBe(true);
    expect(esTransversal("chef_corporativo")).toBe(true);
    expect(esTransversal("enfermera")).toBe(false);
    expect(esTransversal("cocinera")).toBe(false);
  });

  it("hay 8 roles y 14 alérgenos Codex", () => {
    expect(ROLES).toHaveLength(8);
    expect(ALERGENOS_CODEX).toHaveLength(14);
  });

  it("loginInput exige usuario y contraseña", () => {
    expect(loginInput.safeParse({ username: "", password: "x" }).success).toBe(false);
    expect(loginInput.safeParse({ username: "admin", password: "x" }).success).toBe(true);
  });

  it("alergiaInput aplica defaults (ALERGIA/MODERADA)", () => {
    const r = alergiaInput.parse({ pacienteId: 1, tipoAlimento: "alimento", alimentoId: 34 });
    expect(r.tipoRestriccion).toBe("ALERGIA");
    expect(r.severidad).toBe("MODERADA");
  });

  it("normalizar limpia espacios y mayúsculas", () => {
    expect(normalizar("  LECHE  de   Vaca ")).toBe("leche de vaca");
  });
});
