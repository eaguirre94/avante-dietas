# AVANTE · Dietas v2

Marcaje de entrada/salida por teléfono para Complejo Avante, reconstruido en el
**stack empresarial estándar de TI**. Reemplaza a la app v1 (Python stdlib + SQLite)
preservando toda la lógica: fichajes ilimitados, RBAC (super/gerente/jefe), candado
de red, token 1 teléfono ↔ 1 empleado, auditoría de ajustes y trazabilidad por sede.

## Stack
| Capa | Tecnología |
|---|---|
| Runtime / Lenguaje | Node 22 · TypeScript 5 (strict) |
| Framework / UI | Next.js 16 (App Router, `output: standalone`) · React 19 · Tailwind 4 · shadcn/ui |
| API interno (BFF) | tRPC 11 (`@trpc/tanstack-react-query`) · TanStack Query 5 |
| Contrato / Forms | Zod 4 (cliente = servidor) · React Hook Form + zodResolver |
| ORM / BD | Prisma 6 (multiSchema) · PostgreSQL 17 (CloudNativePG) |
| Auth | Auth.js / NextAuth v5 (panel) |
| Test | Vitest (unit) · Playwright (E2E) |
| Monorepo / CI/CD | pnpm workspaces + Turborepo · GitHub Actions → GHCR → ArgoCD (GitOps) · Docker → Kubernetes |

## Estructura
```
apps/web              Next.js (UI + API tRPC + Auth.js + lógica de servidor)
packages/validators   Contrato Zod (una sola fuente de verdad)
packages/db           Prisma (schema, cliente, seed, migración desde v1)
infra/k8s             Manifiestos K8s + CloudNativePG
infra/argocd          ArgoCD Application (GitOps)
```

## Desarrollo local
```bash
pnpm install
cp .env.example apps/web/.env            # ajustar AUTH_SECRET; DEV_MODE=true en local
docker compose up -d --wait postgres     # Postgres 17 local
pnpm db:generate && pnpm db:push         # crea el esquema
pnpm db:seed                             # admin "master" + empleados demo
# — o migrar los datos reales de la v1: —
#   python packages/db/tools/export_legacy.py
#   pnpm db:migrate-legacy
pnpm --filter @avante/web dev            # http://localhost:3000  (panel: /admin)
```

Verificación: `pnpm typecheck` · `pnpm test` · `pnpm --filter @avante/web build`.

## Candado de red (importante en la nube)
El marcaje solo se permite desde la red de Avante. On-prem eso es la subred LAN;
**en Kubernetes el servidor ve la IP pública**, así que `AVANTE_CIDRS` debe contener
la **IP pública fija de cada sede** (solicitar al ISP; cuidado con CGNAT). El ingress
debe preservar la IP real del cliente (`X-Forwarded-For`, `TRUST_FORWARDED_FOR=true`).

## Despliegue (GitOps)
1. Push a `main` → GitHub Actions corre lint/typecheck/test/build y publica las
   imágenes `:latest` y `:migrator` en GHCR.
2. ArgoCD sincroniza `infra/k8s` (crea el namespace, el cluster CloudNativePG, corre
   las migraciones como hook PreSync y despliega la web).
3. El secreto real (`DATABASE_URL`, `AUTH_SECRET`) se gestiona con Sealed Secrets /
   SOPS / External Secrets — **nunca** en el repo.

## Migración desde la v1
`packages/db/tools/export_legacy.py` vuelca la SQLite de la v1 a JSON y
`pnpm db:migrate-legacy` la carga en Postgres: roster desde `colaboradores.csv`,
admins **con su hash pbkdf2 intacto** (nadie cambia su clave), dispositivos y marcas.
