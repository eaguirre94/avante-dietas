import { describe, it, expect } from "vitest";
import { puedeTransicionar, TRANSICIONES_VALIDAS, ESTADOS_TEMPRANOS } from "./estados";

describe("máquina de estados de la comida", () => {
  it("camino feliz completo es válido", () => {
    const secuencia = [
      "ASIGNADA", "EN_OFERTA", "OFERTA_CONFIRMADA",
      "EN_PREPARACION", "LISTA", "EN_TRANSITO", "ENTREGADA",
    ] as const;
    for (let i = 0; i < secuencia.length - 1; i++) {
      expect(puedeTransicionar(secuencia[i]!, secuencia[i + 1]!)).toBe(true);
    }
  });

  it("ENTREGADA es terminal", () => {
    expect(TRANSICIONES_VALIDAS.ENTREGADA).toEqual([]);
    expect(puedeTransicionar("ENTREGADA", "EN_OFERTA")).toBe(false);
  });

  it("no permite saltar de ASIGNADA a ENTREGADA", () => {
    expect(puedeTransicionar("ASIGNADA", "ENTREGADA")).toBe(false);
  });

  it("todo estado no terminal puede cancelarse", () => {
    for (const e of ["ASIGNADA", "EN_OFERTA", "OFERTA_CONFIRMADA", "EN_PREPARACION", "LISTA", "EN_TRANSITO"] as const) {
      expect(puedeTransicionar(e, "CANCELADA")).toBe(true);
    }
  });

  it("los estados tempranos (D3) son antes de cocina", () => {
    expect(ESTADOS_TEMPRANOS).toContain("OFERTA_CONFIRMADA");
    expect(ESTADOS_TEMPRANOS).not.toContain("EN_PREPARACION");
  });
});
