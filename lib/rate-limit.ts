import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const JANELA_MS = 5 * 60 * 1000;
const MAX_REQUISICOES = 10;
const LIMITE_ENTRADAS = 5000;

const mapaMemoria = new Map<string, number[]>();

let rateLimitUpstash: Ratelimit | undefined;
let rateLimitUpstashInicializado = false;

function temUpstashConfigurado(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
}

function obtemRateLimitUpstash(): Ratelimit {
  if (!rateLimitUpstashInicializado) {
    rateLimitUpstashInicializado = true;
    rateLimitUpstash = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(MAX_REQUISICOES, `${JANELA_MS / 1000} s`),
      prefix: "vulnexusai:ratelimit",
    });
  }
  return rateLimitUpstash!;
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

function checaRateLimitMemoria(ip: string): { permitido: boolean; retryEmSegundos: number } {
  const agora = Date.now();
  const registros = (mapaMemoria.get(ip) ?? []).filter(t => agora - t < JANELA_MS);

  if (registros.length >= MAX_REQUISICOES) {
    mapaMemoria.set(ip, registros);
    limpaEntradas(agora);
    const maisAntigo = registros[0] ?? agora;
    const retryEmSegundos = Math.max(1, Math.ceil((JANELA_MS - (agora - maisAntigo)) / 1000));
    return { permitido: false, retryEmSegundos };
  }

  registros.push(agora);
  mapaMemoria.set(ip, registros);
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

export async function checaRateLimit(ip: string): Promise<{ permitido: boolean; retryEmSegundos: number }> {
  if (temUpstashConfigurado()) {
    const resultado = await obtemRateLimitUpstash().limit(ip);
    const retryEmSegundos = resultado.reset ? Math.max(1, Math.ceil((resultado.reset - Date.now()) / 1000)) : 1;
    return { permitido: resultado.success, retryEmSegundos };
  }
  return checaRateLimitMemoria(ip);
}
