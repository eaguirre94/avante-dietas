import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@/server/trpc/root";

/** Integración tRPC 11 + TanStack Query (tipos end-to-end desde el servidor). */
export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
