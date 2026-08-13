import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const fonte = readFile(
  join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")
);

const logo = readFile(join(process.cwd(), "public/vulnexusai.svg"));

export const ALT = "VulnexusAI — Verificação de segurança de sites";

export const TAMANHO = {
  width: 1200,
  height: 630,
};

export const TIPO_CONTENT = "image/png";

export async function gerarImagemOg(): Promise<ImageResponse> {
  const [dadosFonte, dadosLogo] = await Promise.all([fonte, logo]);
  const logoSrc = `data:image/svg+xml;base64,${Buffer.from(dadosLogo).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(160deg, #0b1220 0%, #111a2e 100%)",
          fontFamily: "Geist",
          color: "#e6edf7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img
            src={logoSrc}
            width={88}
            height={88}
            style={{ display: "flex", boxShadow: "0 8px 32px rgba(59, 130, 246, 0.35)" }}
          />
          <div style={{ fontSize: 68, fontWeight: 700, display: "flex" }}>
            Vulnexus
            <span style={{ color: "#3b82f6" }}>AI</span>
          </div>
        </div>
        <div style={{ marginTop: 32, fontSize: 34, color: "#8fa1c0", textAlign: "center" }}>
          Verificação de segurança de sites em um clique
        </div>
        <div style={{ marginTop: 40, display: "flex", gap: 16 }}>
          <div
            style={{
              fontSize: 24,
              color: "#16a34a",
              border: "2px solid #16a34a",
              borderRadius: 999,
              padding: "12px 28px",
            }}
          >
            Score automático
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#3b82f6",
              border: "2px solid #3b82f6",
              borderRadius: 999,
              padding: "12px 28px",
            }}
          >
            HTTPS · Headers · DNS
          </div>
        </div>
      </div>
    ),
    {
      ...TAMANHO,
      fonts: [
        {
          name: "Geist",
          data: dadosFonte,
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
}
