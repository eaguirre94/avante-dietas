import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { catalogoRouter } from "./routers/catalogo";
import { enfermeriaRouter } from "./routers/enfermeria";
import { auxiliarRouter } from "./routers/auxiliar";
import { cocinaRouter } from "./routers/cocina";
import { nutricionistaRouter } from "./routers/nutricionista";
import { tarifasRouter } from "./routers/tarifas";
import { alergiasRouter } from "./routers/alergias";

export const appRouter = router({
  auth: authRouter,
  catalogo: catalogoRouter,
  enfermeria: enfermeriaRouter,
  auxiliar: auxiliarRouter,
  cocina: cocinaRouter,
  nutricionista: nutricionistaRouter,
  tarifas: tarifasRouter,
  alergias: alergiasRouter,
});

export type AppRouter = typeof appRouter;
