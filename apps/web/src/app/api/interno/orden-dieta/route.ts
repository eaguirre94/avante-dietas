import { NextResponse } from "next/server";
import { prisma } from "@avante/db";
import {
  crearOrdenDieta,
  OrdenDietaError,
  ordenDietaInput,
  verificarTokenEcosistema,
} from "@/server/interno/orden-dieta";

/**
 * POST /api/interno/orden-dieta — endpoint interno del ecosistema Avante.
 * El HIS-Frontal (server-to-server) crea aquí una orden de dieta real cuando
 * el médico la indica en su CPOE.
 *
 * Auth: header `x-avante-token` debe igualar env AVANTE_ECOSISTEMA_TOKEN
 * (sin env → 503 "integración no configurada"; token errado → 401).
 * `modo:"ping"` valida token + shape sin escribir nada.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = verificarTokenEcosistema(req.headers.get("x-avante-token"));
  if (!token.ok) {
    return NextResponse.json({ ok: false, error: token.error }, { status: token.status });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body no es JSON válido." }, { status: 400 });
  }

  const parsed = ordenDietaInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Body inválido.", detalles: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (parsed.data.modo === "ping") {
    return NextResponse.json({ ok: true, modo: "ping" });
  }

  try {
    const resultado = await crearOrdenDieta(prisma, parsed.data);
    return NextResponse.json({ ok: true, ...resultado }, { status: 201 });
  } catch (e) {
    if (e instanceof OrdenDietaError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    console.error("[api/interno/orden-dieta]", e);
    return NextResponse.json(
      { ok: false, error: "Error interno al crear la orden de dieta." },
      { status: 500 },
    );
  }
}
