import { NextRequest } from "next/server";
import { normalizaUrl, VerificadorErro } from "@/lib/verificador";
import { checaRateLimit, ipDaRequisicao } from "@/lib/rate-limit";
import { adicionaMonitor, removeMonitor, type Monitor, type WebhookTipo } from "@/lib/monitor";
import { agendaMonitoramento, cancelaMonitoramento, cronValido, CRON_PADRAO, QStashErro } from "@/lib/qstash";

export const maxDuration = 30;

const LIMITE_BODY = 4096;
const WEBHOOK_TIPOS: WebhookTipo[] = ["discord", "slack"];

function respostaErro(erro: string, codigo: string, status: number) {
  return Response.json({ erro, codigo }, { status });
}

function respostaRateLimit(retryEmSegundos: number): Response {
  return Response.json(
    {
      erro: `Você atingiu o limite temporário de verificações. Aguarde ${retryEmSegundos} segundo(s) e tente novamente.`,
      codigo: "rate-limit",
      retryEmSegundos,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryEmSegundos),
        "Cache-Control": "no-store",
      },
    }
  );
}

async function leCorpo(request: NextRequest): Promise<{ corpo: unknown; resposta: Response | null }> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > LIMITE_BODY) {
    return { corpo: null, resposta: respostaErro("Corpo da requisição muito grande (máx. 4096 caracteres).", "corpo-grande", 413) };
  }

  let texto: string;
  try {
    texto = await request.text();
  } catch {
    return { corpo: null, resposta: respostaErro("Falha ao ler o corpo da requisição.", "corpo-invalido", 400) };
  }

  if (texto.length > LIMITE_BODY) {
    return { corpo: null, resposta: respostaErro("Corpo da requisição muito grande (máx. 4096 caracteres).", "corpo-grande", 413) };
  }

  try {
    return { corpo: JSON.parse(texto), resposta: null };
  } catch {
    return { corpo: null, resposta: respostaErro("JSON inválido.", "json-invalido", 400) };
  }
}

function validaWebhookUrl(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor.trim()) return null;
  try {
    const url = new URL(valor.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const ip = ipDaRequisicao(request);
  const limite = await checaRateLimit(ip, "monitor");
  if (!limite.permitido) return respostaRateLimit(limite.retryEmSegundos);

  const { corpo, resposta } = await leCorpo(request);
  if (resposta) return resposta;

  const body = corpo as { url?: unknown; webhookUrl?: unknown; webhookTipo?: unknown; cron?: unknown };

  if (typeof body.url !== "string" || !body.url.trim()) {
    return respostaErro("Informe uma URL.", "url-ausente", 400);
  }

  let hostname: string;
  let urlOriginal: string;
  try {
    const url = normalizaUrl(body.url);
    hostname = url.hostname;
    urlOriginal = url.href;
  } catch (err) {
    return err instanceof VerificadorErro
      ? respostaErro(err.message, err.codigo, 422)
      : respostaErro("URL inválida.", "url-invalida", 422);
  }

  const webhookUrl = validaWebhookUrl(body.webhookUrl);
  if (!webhookUrl) {
    return respostaErro("Informe uma URL de webhook válida (Discord ou Slack).", "webhook-url-invalida", 400);
  }

  const webhookTipo = typeof body.webhookTipo === "string" ? (body.webhookTipo as WebhookTipo) : "discord";
  if (!WEBHOOK_TIPOS.includes(webhookTipo)) {
    return respostaErro("webhookTipo deve ser \"discord\" ou \"slack\".", "webhook-tipo-invalido", 400);
  }

  const cron = typeof body.cron === "string" && body.cron.trim() ? body.cron.trim() : CRON_PADRAO;
  if (!cronValido(cron)) {
    return respostaErro("Expressão cron inválida. Use o formato de 5 campos (minuto hora dia mês dia-da-semana).", "cron-invalido", 400);
  }

  const monitor: Monitor = {
    url: urlOriginal,
    hostname,
    webhookUrl,
    webhookTipo,
    cron,
    criadoEm: new Date().toISOString(),
  };

  try {
    await agendaMonitoramento(hostname, cron);
  } catch (err) {
    if (err instanceof QStashErro) {
      return respostaErro(err.message, err.codigo, 502);
    }
    return respostaErro("Falha ao agendar o monitoramento.", "agendamento-falhou", 502);
  }

  await adicionaMonitor(monitor);

  return Response.json(
    {
      ok: true,
      hostname,
      webhookTipo,
      cron,
      mensagem: `Monitoramento de ${hostname} ativado — rodará de acordo com o cron "${cron}" e avisará no webhook quando o score cair ou um item piorar.`,
    },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest) {
  const ip = ipDaRequisicao(request);
  const limite = await checaRateLimit(ip, "monitor");
  if (!limite.permitido) return respostaRateLimit(limite.retryEmSegundos);

  const { corpo, resposta } = await leCorpo(request);
  if (resposta) return resposta;

  const body = corpo as { url?: unknown };
  if (typeof body.url !== "string" || !body.url.trim()) {
    return respostaErro("Informe uma URL.", "url-ausente", 400);
  }

  let hostname: string;
  try {
    hostname = normalizaUrl(body.url).hostname;
  } catch (err) {
    return err instanceof VerificadorErro
      ? respostaErro(err.message, err.codigo, 422)
      : respostaErro("URL inválida.", "url-invalida", 422);
  }

  await removeMonitor(hostname);

  try {
    await cancelaMonitoramento(hostname);
  } catch (erro) {
    console.error(`[monitor] Falha ao cancelar o agendamento de ${hostname}:`, erro);
  }

  return Response.json({ ok: true, hostname }, { status: 200 });
}