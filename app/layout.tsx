import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VerificaSeguranca — Verificação básica de segurança de sites",
  description:
    "Verifique headers de segurança HTTP, HTTPS e certificado SSL de qualquer site com um score automático.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
