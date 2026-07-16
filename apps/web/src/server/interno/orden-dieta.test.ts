import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { PrismaClient } from "@avante/db";
import {
  crearOrdenDieta,
  OrdenDietaError,
  ordenDietaInput,
  tiempoDefaultCodigo,
  verificarTokenEcosistema,
} from "./orden-dieta";

// ── Contrato (Zod) ───────────────────────────────────────────────────────────
describe("ordenDietaInput (contrato del endpoint interno)", () => {
  const base = {
    origen: "HIS",
    pacienteNombre: "PRUEBA ECOSISTEMA HIS",
    dieta: "CORR",
    indicadoPor: "Dr. Prueba",
  };

  it("acepta el body mínimo y aplica defaults (modo crear, alergias [])", () => {
    const r = ordenDietaInput.parse(base);
    expect(r.modo).toBe("crear");
    expect(r.alergias).toEqual([]);
  });

  it("acepta modo ping con el mismo shape", () => {
    const r = ordenDietaInput.parse({ ...base, modo: "ping" });
    expect(r.modo).toBe("ping");
  });

  it("acepta refs Odoo y alergias", () => {
    const r = ordenDietaInput.parse({
      ...base,
      pacienteOdooId: 10,
      citaOdooId: 20,
      folioOdooId: 30,
      alergias: ["Mariscos", "Leche"],
      detalle: "Sin sal agregada",
    });
    expect(r.folioOdooId).toBe(30);
    expect(r.alergias).toHaveLength(2);
  });

  it("rechaza origen distinto de HIS", () => {
    expect(ordenDietaInput.safeParse({ ...base, origen: "OTRO" }).success).toBe(false);
  });

  it("rechaza body sin indicadoPor o sin paciente", () => {
    expect(ordenDietaInput.safeParse({ ...base, indicadoPor: undefined }).success).toBe(false);
    expect(ordenDietaInput.safeParse({ ...base, pacienteNombre: "X" }).success).toBe(false);
  });
});

// ── Token compartido ─────────────────────────────────────────────────────────
describe("verificarTokenEcosistema", () => {
  const ENV = "AVANTE_ECOSISTEMA_TOKEN";
  let original: string | undefined;
  beforeEach(() => {
    original = process.env[ENV];
  });
  afterEach(() => {
    if (original === undefined) delete process.env[ENV];
    else process.env[ENV] = original;
  });

  it("sin env configurada → 503 integración no configurada", () => {
    delete process.env[ENV];
    const r = verificarTokenEcosistema("lo-que-sea");
    expect(r).toEqual({ ok: false, status: 503, error: "integración no configurada" });
  });

  it("token ausente o errado → 401", () => {
    process.env[ENV] = "secreto-correcto";
    expect(verificarTokenEcosistema(null)).toMatchObject({ ok: false, status: 401 });
    expect(verificarTokenEcosistema("otro")).toMatchObject({ ok: false, status: 401 });
    expect(verificarTokenEcosistema("secreto-correctoX")).toMatchObject({ ok: false, status: 401 });
  });

  it("token correcto → ok", () => {
    process.env[ENV] = "secreto-correcto";
    expect(verificarTokenEcosistema("secreto-correcto")).toEqual({ ok: true });
  });
});

// ── Tiempo por defecto ───────────────────────────────────────────────────────
describe("tiempoDefaultCodigo", () => {
  it("mañana → Desayuno, mediodía → Almuerzo, tarde/noche → Cena", () => {
    expect(tiempoDefaultCodigo(7.5)).toBe("D");
    expect(tiempoDefaultCodigo(12)).toBe("A");
    expect(tiempoDefaultCodigo(19)).toBe("C");
  });
});

// ── crearOrdenDieta con Prisma simulado ──────────────────────────────────────
function fakeTx() {
  return {
    dietas: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    tiempos: { findFirst: vi.fn() },
    usuarios_dietas: { findFirst: vi.fn() },
    sedes: { findFirst: vi.fn() },
    clientes: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
    },
    alimentos: { findFirst: vi.fn().mockResolvedValue(null) },
    paciente_restriccion_alimento: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    indicacion_medica: { create: vi.fn() },
    menu: { findFirst: vi.fn().mockResolvedValue(null) },
    comida_elegida: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
    comida_elegida_linea: { createMany: vi.fn() },
    dieta_tiempo_plato: { findMany: vi.fn().mockResolvedValue([]) },
    evento_dieta: { create: vi.fn().mockResolvedValue({}) },
  };
}
const asPrisma = (tx: ReturnType<typeof fakeTx>) =>
  ({ $transaction: (fn: (t: unknown) => unknown) => fn(tx) }) as unknown as PrismaClient;

const inputBase = ordenDietaInput.parse({
  origen: "HIS",
  pacienteNombre: "PRUEBA ECOSISTEMA HIS",
  dieta: "CORR",
  indicadoPor: "Dr. Prueba",
  folioOdooId: 999_999,
  alergias: ["Mariscos"],
});

describe("crearOrdenDieta", () => {
  it("dieta inexistente → OrdenDietaError 422 (no escribe nada)", async () => {
    const tx = fakeTx();
    tx.dietas.findFirst.mockResolvedValue(null); // ni código ni nombre
    await expect(crearOrdenDieta(asPrisma(tx), inputBase)).rejects.toMatchObject({
      name: "OrdenDietaError",
      status: 422,
    });
    expect(tx.indicacion_medica.create).not.toHaveBeenCalled();
    expect(tx.clientes.create).not.toHaveBeenCalled();
  });

  it("camino feliz: crea paciente mínimo + alergia texto libre + indicación; sin menú vigente avisa", async () => {
    const tx = fakeTx();
    tx.dietas.findFirst.mockResolvedValueOnce({ id: 9, codigo: "CORR", nombre: "Corriente" });
    tx.tiempos.findFirst.mockResolvedValue({ id: 5, codigo: "C", nombre: "Cena" });
    tx.usuarios_dietas.findFirst
      .mockResolvedValueOnce(null) // no existe 'integracion.his'
      .mockResolvedValueOnce({ id: 1, username: "admin" });
    tx.sedes.findFirst.mockResolvedValue({ id: 2, codigo: "HE" });
    tx.clientes.create.mockResolvedValue({ id: 77 });
    tx.indicacion_medica.create.mockResolvedValue({ id: 123 });

    const r = await crearOrdenDieta(asPrisma(tx), inputBase);

    expect(r.ordenId).toBe(123);
    expect(r.detalles.clienteId).toBe(77);
    expect(r.detalles.clienteCreado).toBe(true);
    expect(r.detalles.bandeja).toBe("SIN_MENU_VIGENTE");
    expect(r.detalles.alergiasRegistradas).toBe(1);

    // El paciente mínimo guarda la referencia externa (folio Odoo).
    expect(tx.clientes.create.mock.calls[0]![0].data).toMatchObject({
      nombre: "PRUEBA ECOSISTEMA HIS",
      erp_hospitalizacion_id: 999_999,
      habitacion: "S/A",
    });
    // Alergia sin match de catálogo → texto libre con el CHECK correcto.
    expect(tx.paciente_restriccion_alimento.create.mock.calls[0]![0].data).toMatchObject({
      tipo_alimento: "grupo_alimentario",
      alimento_id: 0,
      grupo_alimentario: "Mariscos",
      tipo_restriccion: "ALERGIA",
      fuente: "EXPEDIENTE_EXTERNO",
    });
    // La indicación la firma el usuario de sistema y trae la trazabilidad HIS.
    const ind = tx.indicacion_medica.create.mock.calls[0]![0].data;
    expect(ind.enfermera_id).toBe(1);
    expect(ind.notas_clinicas).toContain("Dr. Prueba");
    expect(ind.notas_clinicas).toContain("Folio Odoo: 999999");
  });

  it("alergia que coincide con alimento del catálogo se registra como ('alimento', id)", async () => {
    const tx = fakeTx();
    tx.dietas.findFirst.mockResolvedValueOnce({ id: 9, codigo: "CORR", nombre: "Corriente" });
    tx.tiempos.findFirst.mockResolvedValue({ id: 3, codigo: "A", nombre: "Almuerzo" });
    tx.usuarios_dietas.findFirst.mockResolvedValue({ id: 1, username: "admin" });
    // Paciente existente encontrado por folio, ya vinculado a Odoo.
    tx.clientes.findUnique.mockResolvedValue({
      id: 50,
      erp_hospitalizacion_id: 999_999,
      erp_partner_id: 4,
    });
    tx.alimentos.findFirst.mockResolvedValue({ id: 55 });
    tx.indicacion_medica.create.mockResolvedValue({ id: 200 });

    const r = await crearOrdenDieta(asPrisma(tx), { ...inputBase, alergias: ["Camarón"] });

    expect(r.detalles.clienteCreado).toBe(false);
    expect(tx.clientes.create).not.toHaveBeenCalled();
    expect(tx.paciente_restriccion_alimento.create.mock.calls[0]![0].data).toMatchObject({
      tipo_alimento: "alimento",
      alimento_id: 55,
      grupo_alimentario: null,
    });
  });
});
