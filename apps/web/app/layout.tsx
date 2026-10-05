import type { Metadata } from "next";
import "./globals.css";
import StyledJsxRegistry from "./registry";

export const metadata: Metadata = {
  title: "Condofy — Gestão de Condomínio Simples e Completa",
  description:
    "Condofy reúne cadastro de moradores, portaria digital, reservas e avisos em um só lugar. Simples para o síndico, fácil para o morador.",
  metadataBase: new URL("https://web-production-48670.up.railway.app"),
  openGraph: {
    title: "Condofy — Gestão de Condomínio Simples e Completa",
    description: "Gerencie seu condomínio com simplicidade. Moradores, portaria, reservas e avisos em um só lugar.",
    url: "https://web-production-48670.up.railway.app",
    siteName: "Condofy",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Condofy — Gerencie seu condomínio com simplicidade"
      }
    ],
    locale: "pt_BR",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Condofy — Gestão de Condomínio Simples e Completa",
    description: "Gerencie seu condomínio com simplicidade.",
    images: ["/og-image.png"]
  }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <StyledJsxRegistry>{children}</StyledJsxRegistry>
      </body>
    </html>
  );
}
