import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Providers } from "@/lib/trpc/provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-jb", display: "swap" });

export const metadata: Metadata = {
  title: "Dietas AVANTE",
  description: "Módulo de Dietas Hospitalarias — AVANTE Complejo Hospitalario",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0e22",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${space.variable} ${mono.variable}`}>
      <body>
        <div className="bg-grid" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
