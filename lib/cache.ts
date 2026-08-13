import { Redis } from "@upstash/redis";

const TTL_PADRAO_MS = 5 * 60 * 1000;

const cacheMemoria = new Map<string, { valor: string; expiraEm: number }>();

let redis: Redis | undefined;
let redisInicializado = false;

function temUpstashConfigurado(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function obtemRedis(): Redis | undefined {
  if (!redisInicializado) {
    redisInicializado = true;
    if (temUpstashConfigurado()) {
      redis = Redis.fromEnv();
    }
  }
  return redis;
}

export async function cacheGet(chave: string): Promise<string | null> {
  const cliente = obtemRedis();
  if (cliente) {
    try {
      return await cliente.get<string>(chave);
    } catch {
      return null;
    }
  }
  const item = cacheMemoria.get(chave);
  if (!item) return null;
  if (item.expiraEm <= Date.now()) {
    cacheMemoria.delete(chave);
    return null;
  }
  return item.valor;
}

export async function cacheSet(chave: string, valor: string, ttlMs = TTL_PADRAO_MS): Promise<void> {
  const cliente = obtemRedis();
  if (cliente) {
    try {
      await cliente.set(chave, valor, { ex: Math.ceil(ttlMs / 1000) });
    } catch {
      return;
    }
    return;
  }
  cacheMemoria.set(chave, { valor, expiraEm: Date.now() + ttlMs });
}
