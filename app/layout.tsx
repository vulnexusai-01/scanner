import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VulnexusAI — Verificação de segurança de sites",
  description:
    "Verifique headers de segurança HTTP, HTTPS, certificado SSL, DNS de email e cookies com score automático da VulnexusAI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
