import { NextRequest } from "next/server";
import { verificarSite } from "@/lib/verificador";
import { checaRateLimit, ipDaRequisicao } from "@/lib/rate-limit";

export const maxDuration = 30;

function escapaXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function corDaNota(score: number): string {
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#22c55e";
  if (score >= 50) return "#d97706";
  if (score >= 30) return "#ea580c";
  return "#dc2626";
}

function badgeSvg(score: number | null, grade: string | null): string {
  const rotulo = score === null ? "falha" : `${score} (${grade})`;
  const cor = score === null ? "#64748b" : corDaNota(score);
  const larguraEsquerda = 128;
  const larguraDireita = 116;
  const largura = larguraEsquerda + larguraDireita;
  const centroDireita = larguraEsquerda + larguraDireita / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="28" role="img" aria-label="VulnexusAI score ${escapaXml(rotulo)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#3b82f6"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="${largura}" height="28" rx="6" fill="#0b1220"/>
  <rect x="0" y="0" width="${larguraEsquerda}" height="28" rx="6" fill="url(#g)"/>
  <text x="${larguraEsquerda / 2}" y="19" font-family="Verdana, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">VulnexusAI</text>
  <text x="${centroDireita}" y="19" font-family="Verdana, sans-serif" font-size="13" font-weight="bold" fill="${cor}" text-anchor="middle">${escapaXml(rotulo)}</text>
</svg>`;
}

export async function GET(request: NextRequest) {
  const ip = ipDaRequisicao(request);
  const limite = checaRateLimit(ip);
  if (!limite.permitido) {
    return new Response("Muitas requisições. Tente novamente em instantes.", {
      status: 429,
      headers: { "Retry-After": String(limite.retryEmSegundos) },
    });
  }

  const url = request.nextUrl.searchParams.get("url") ?? "";
  if (!url.trim()) {
    return new Response("Informe o parâmetro url.", { status: 400 });
  }

  let score: number | null = null;
  let grade: string | null = null;
  try {
    const resultado = await verificarSite(url);
    score = resultado.score;
    grade = resultado.grade;
  } catch {
    score = null;
    grade = null;
  }

  return new Response(badgeSvg(score, grade), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=300",
      "access-control-allow-origin": "*",
    },
  });
}
