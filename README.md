# AVANTE · Módulo de Dietas Hospitalarias

Sistema que opera el **ciclo completo de la dieta de un paciente** en el Complejo
Avante: la enfermera indica la dieta → el auxiliar la ofrece y confirma con el
paciente → la cocina la prepara (tablero KDS) → el auxiliar la entrega y se
contabiliza el cargo. Incluye catálogo de dietas/alimentos, motor de alergias,
inventario y tarifas. Reconstruido en el **stack empresarial estándar de TI**
(este repo) a partir de la v2 (FastAPI + React) que sigue en producción.

> **Para analizar el sistema, empezá por:** este README → el modelo de datos en
> [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) (53 tablas)
> → los routers de negocio en [`apps/web/src/server/trpc/routers/`](apps/web/src/server/trpc/routers/)
> → los motores en [`apps/web/src/server/`](apps/web/src/server/).

## Stack (estándar de TI)
| Capa | Tecnología |
|---|---|
| Runtime / Lenguaje | Node 22 · TypeScript 5 (strict) |
| Framework / UI | Next.js 16 (App Router, `output: standalone`) · React 19 · Tailwind 4 · shadcn/ui |
| API interno (BFF) | tRPC 11 (`@trpc/tanstack-react-query`) · TanStack Query 5 |
| Contrato / Forms | Zod 4 (cliente = servidor) · React Hook Form + zodResolver |
| ORM / BD | Prisma 6 (multiSchema) · PostgreSQL 17 (CloudNativePG) |
| Auth | Auth.js / NextAuth v5 |
| Test | Vitest (unit) · Playwright (E2E) |
| Monorepo / CI/CD | pnpm workspaces + Turborepo · GitHub Actions → GHCR → ArgoCD (GitOps) · Docker → Kubernetes |

## Estructura del monorepo
```
apps/web                     Next.js: UI por rol + API tRPC + Auth.js + lógica de servidor
  src/app/                   Pantallas: /login, /enfermeria, /auxiliar, /cocina, /nutricion, /tarifas
  src/server/                Motores y auth:
    auth.ts                  Login (Auth.js v5) contra usuarios_dietas (bcrypt)
    estados.ts               Máquina de estados de la comida
    alergias.ts              Motor de alergias (expansión por grupo Codex)
    comida.ts                Transición de estado + bitácora
    tenancy.ts               Aislamiento por sede (roles transversales vs de sede)
    trpc/routers/            Un router por módulo (catalogo, enfermeria, auxiliar,
                             cocina, nutricionista, tarifas, alergias)
packages/validators          Contrato Zod (roles, estados, alérgenos, inputs) — 1 sola fuente
packages/db                  Prisma: schema (introspectado de la BD real) + cliente + verifyPassword
infra/k8s                    Manifiestos Kubernetes + CloudNativePG
infra/argocd                 ArgoCD Application (GitOps)
legacy/                      (opcional) snapshot de referencia de la app v2
```

## Dominio (qué hace)
- **Roles (8):** `doctor`, `enfermera`, `auxiliar`, `cocinera`, `admin`,
  `nutricionista`, `chef_corporativo`, `jefe_cocina`. Los tres últimos + admin son
  **transversales** (ven todas las sedes); el resto queda acotado a su sede.
- **Ciclo de la comida (máquina de estados):**
  `ASIGNADA → EN_OFERTA → OFERTA_CONFIRMADA → EN_PREPARACION → LISTA → EN_TRANSITO → ENTREGADA`
  (cualquier estado no terminal puede ir a `CANCELADA`).
- **Motor de alergias:** una alergia a un alimento se **expande a todo su grupo
  Codex** (alérgico a la leche ⇒ evita todos los lácteos). El KDS de cocina marca
  las líneas en conflicto con "⚠ NO PREPARAR". La captura resuelve texto libre →
  alimento del catálogo para que igual dispare el bloqueo.
- **Regla anti-duplicado (D3):** re-indicar el mismo paciente+tiempo reemplaza la
  bandeja si aún no está en cocina; si ya está en preparación o más, bloquea.
- **Tarifas:** precio por dieta (default configurable); solo `admin` edita.

## Modelo de datos
`packages/db/prisma/schema.prisma` es la **fuente de verdad estructural** (53 tablas,
introspectadas de la BD Postgres real). Tablas núcleo: `usuarios_dietas`, `sedes`,
`clientes` (pacientes), `dietas`, `tiempos`, `menu`, `dieta_tiempo_plato`, `platos`,
`alimentos`, `comida_elegida` (+ `_linea`), `indicacion_medica`, `evento_dieta`
(bitácora), `alergia_intolerancia`, `paciente_restriccion_alimento`, `inventario_lote`,
`movimiento_inventario`, `cafeteria_orden`, `qr_habitacion`.

## Desarrollo local
```bash
pnpm install
# apps/web/.env necesita DATABASE_URL (Postgres) y AUTH_SECRET
pnpm db:generate                          # genera el cliente Prisma
pnpm --filter @avante/web dev             # http://localhost:3000  (login en /login)
```
La BD ya existe (Postgres); el schema se obtuvo con `prisma db pull` (introspección).
Verificación: `pnpm typecheck` · `pnpm test` · `pnpm --filter @avante/web build`.

## Autenticación
Login del personal contra la tabla `usuarios_dietas` con **bcrypt** (compatible con
los hashes existentes — nadie cambia su clave). Sesión JWT (Auth.js v5). A futuro se
recomienda **SSO Microsoft Entra ID** (cuentas M365 del hospital) como provider extra.

## Despliegue (GitOps)
1. Push a `main` → GitHub Actions corre typecheck/test/build y publica las imágenes
   (`runner` y `migrator`) en GHCR.
2. ArgoCD sincroniza `infra/k8s` (namespace + cluster CloudNativePG + migraciones como
   hook PreSync + la web).
3. Los secretos reales (`DATABASE_URL`, `AUTH_SECRET`) se gestionan con Sealed Secrets /
   External Secrets — **nunca** en el repo.

## Estado y pendientes
Verificado: `typecheck` · `test` · `build` · smoke live (Prisma → BD real). **Pendiente
de paridad/despliegue:** descuento de inventario FEFO, módulos de cafetería y reportes,
migración de datos a CloudNativePG, y el deploy a Kubernetes. La app v2 (FastAPI + React)
sigue operando en producción mientras se completa el corte.
