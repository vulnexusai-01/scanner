import { NextRequest } from "next/server";
import { verificarSite, VerificadorErro } from "@/lib/verificador";
import { checaRateLimit, ipDaRequisicao } from "@/lib/rate-limit";

export const maxDuration = 30;

const LIMITE_BODY = 2048;

function respostaErro(erro: string, codigo: string, status: number, extras: Record<string, unknown> = {}) {
  return Response.json({ erro, codigo, ...extras }, { status });
}

export async function POST(request: NextRequest) {
  const ip = ipDaRequisicao(request);
  const limite = await checaRateLimit(ip);
  if (!limite.permitido) {
    return Response.json(
      {
        erro: `Muitas requisições. Tente novamente em ${limite.retryEmSegundos} segundo(s).`,
        codigo: "rate-limit",
        retryEmSegundos: limite.retryEmSegundos,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limite.retryEmSegundos),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > LIMITE_BODY) {
    return respostaErro("Corpo da requisição muito grande (máx. 2048 caracteres).", "corpo-grande", 413);
  }

  let texto: string;
  try {
    texto = await request.text();
  } catch {
    return respostaErro("Falha ao ler o corpo da requisição.", "corpo-invalido", 400);
  }

  if (texto.length > LIMITE_BODY) {
    return respostaErro("Corpo da requisição muito grande (máx. 2048 caracteres).", "corpo-grande", 413);
  }

  let body: { url?: unknown };
  try {
    body = JSON.parse(texto);
  } catch {
    return respostaErro("JSON inválido.", "json-invalido", 400);
  }

  const url = typeof body.url === "string" ? body.url : "";
  if (!url.trim()) {
    return respostaErro("Informe uma URL.", "url-ausente", 400);
  }

  try {
    const resultado = await verificarSite(url);
    return Response.json(resultado);
  } catch (err) {
    if (err instanceof VerificadorErro) {
      return respostaErro(err.message, err.codigo, 422);
    }
    const mensagem = err instanceof Error ? err.message : "Falha ao verificar o site.";
    return respostaErro(mensagem, "generico", 422);
  }
}
