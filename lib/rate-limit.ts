import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type ContextoRateLimit = "badge" | "verificar" | "csp-report" | "monitor";

const JANELA_MS = 5 * 60 * 1000;
const LIMITE_ENTRADAS = 5000;

const LIMITES_POR_CONTEXTO: Record<ContextoRateLimit, number> = {
  badge: 25,
  verificar: 10,
  "csp-report": 10,
  monitor: 5,
};

const mapaMemoria = new Map<string, number[]>();

const rateLimitsUpstash = new Map<ContextoRateLimit, Ratelimit>();

function temUpstashConfigurado(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
}

function obtemRateLimitUpstash(contexto: ContextoRateLimit): Ratelimit {
  const existente = rateLimitsUpstash.get(contexto);
  if (existente) return existente;
  const instancia = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(LIMITES_POR_CONTEXTO[contexto], `${JANELA_MS / 1000} s`),
    prefix: `vulnexusai:ratelimit:${contexto}`,
  });
  rateLimitsUpstash.set(contexto, instancia);
  return instancia;
}

export function ipDaRequisicao(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const primeiro = xff.split(",")[0]?.trim();
    if (primeiro) return primeiro;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real;
  return "desconhecido";
}

function checaRateLimitMemoria(ip: string, contexto: ContextoRateLimit): { permitido: boolean; retryEmSegundos: number } {
  const agora = Date.now();
  const chave = `${contexto}:${ip}`;
  const maximo = LIMITES_POR_CONTEXTO[contexto];
  const registros = (mapaMemoria.get(chave) ?? []).filter(t => agora - t < JANELA_MS);

  if (registros.length >= maximo) {
    mapaMemoria.set(chave, registros);
    limpaEntradas(agora);
    const maisAntigo = registros[0] ?? agora;
    const retryEmSegundos = Math.max(1, Math.ceil((JANELA_MS - (agora - maisAntigo)) / 1000));
    return { permitido: false, retryEmSegundos };
  }

  registros.push(agora);
  mapaMemoria.set(chave, registros);
  limpaEntradas(agora);
  return { permitido: true, retryEmSegundos: 0 };
}

function limpaEntradas(agora: number): void {
  if (mapaMemoria.size <= LIMITE_ENTRADAS) return;
  for (const [chave, registros] of mapaMemoria) {
    if (registros.length === 0 || agora - registros[registros.length - 1]! > JANELA_MS) {
      mapaMemoria.delete(chave);
    }
  }
}

export async function checaRateLimit(
  ip: string,
  contexto: ContextoRateLimit
): Promise<{ permitido: boolean; retryEmSegundos: number }> {
  if (temUpstashConfigurado()) {
    const resultado = await obtemRateLimitUpstash(contexto).limit(ip);
    const retryEmSegundos = resultado.reset ? Math.max(1, Math.ceil((resultado.reset - Date.now()) / 1000)) : 1;
    return { permitido: resultado.success, retryEmSegundos };
  }
  return checaRateLimitMemoria(ip, contexto);
}
