import { NextRequest } from "next/server";
import { checaRateLimit, ipDaRequisicao } from "@/lib/rate-limit";

export const maxDuration = 30;

const LIMITE_BODY = 2048;
const TIPOS_ACEITOS = ["application/reports+json", "application/csp-report"];

export async function POST(request: NextRequest) {
  const ip = ipDaRequisicao(request);
  const limite = await checaRateLimit(ip, "csp-report");
  if (!limite.permitido) {
    return new Response(`Você atingiu o limite temporário. Aguarde ${limite.retryEmSegundos}s e tente novamente.`, {
      status: 429,
      headers: { "Retry-After": String(limite.retryEmSegundos) },
    });
  }

  const contentType = (request.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (!TIPOS_ACEITOS.includes(contentType)) {
    return new Response("Tipo de conteúdo não suportado.", { status: 415 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > LIMITE_BODY) {
    return new Response("Corpo da requisição muito grande (máx. 2048 caracteres).", { status: 413 });
  }

  let body: string;
  try {
    body = await request.text();
  } catch {
    return new Response("Falha ao ler o corpo da requisição.", { status: 400 });
  }

  if (body.length > LIMITE_BODY) {
    return new Response("Corpo da requisição muito grande (máx. 2048 caracteres).", { status: 413 });
  }

  console.error(`[csp-report] (${contentType}) ${body}`);
  return new Response(null, { status: 204 });
}
