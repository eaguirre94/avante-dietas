import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empaquetado autocontenido para la imagen Docker (output: standalone).
  output: "standalone",
  reactStrictMode: true,
  // Los paquetes del monorepo se sirven como TypeScript y Next los transpila.
  transpilePackages: ["@avante/db", "@avante/validators"],
  // Prisma no debe empaquetarse: se resuelve como dependencia externa en Node.
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  // Raíz del monorepo para que el standalone incluya los workspaces (@avante/*).
  outputFileTracingRoot: path.join(process.cwd(), "../../"),
};

export default nextConfig;
