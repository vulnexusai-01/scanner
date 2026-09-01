import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { ResultadoCheck } from "./verificador";

export type WebhookTipo = "discord" | "slack";

export type Monitor = {
  url: string;
  hostname: string;
  webhookUrl: string;
  webhookTipo: WebhookTipo;
  cron: string;
  criadoEm: string;
  tokenHash: string;
};

export function geraToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function validaToken(tokenFornecido: string, tokenHashEsperado: string): boolean {
  if (typeof tokenFornecido !== "string" || typeof tokenHashEsperado !== "string") return false;
  if (!tokenFornecido || !tokenHashEsperado) return false;
  const hashFornecido = hashToken(tokenFornecido);
  const bufA = Buffer.from(hashFornecido, "hex");
  const bufB = Buffer.from(tokenHashEsperado, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const TTL_RESULTADO_MS = 90 * 24 * 60 * 60 * 1000;

const PREFIXO_MONITOR = "monitor:";
const PREFIXO_RESULTADO = "monitor:resultado:";

const memoria = new Map<string, string>();

let redis: Redis | undefined;
let redisInicializado = false;

function temUpstashConfigurado(): boolean {
  return Boolean(
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
  );
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

function chaveMonitor(hostname: string): string {
  return `${PREFIXO_MONITOR}${hostname}`;
}

function chaveResultado(hostname: string): string {
  return `${PREFIXO_RESULTADO}${hostname}`;
}

function ehChaveMonitor(chave: string): boolean {
  return chave.startsWith(PREFIXO_MONITOR) && !chave.startsWith(PREFIXO_RESULTADO);
}

function parseiaMonitor(texto: string): Monitor | null {
  try {
    const valor = JSON.parse(texto) as Monitor;
    if (
      typeof valor.hostname === "string" &&
      typeof valor.webhookUrl === "string" &&
      typeof valor.tokenHash === "string"
    ) {
      return valor;
    }
    return null;
  } catch {
    return null;
  }
}

export async function adicionaMonitor(monitor: Monitor): Promise<void> {
  const cliente = obtemRedis();
  const chave = chaveMonitor(monitor.hostname);
  const texto = JSON.stringify(monitor);
  if (cliente) {
    try {
      await cliente.set(chave, texto);
      return;
    } catch {
      return;
    }
  }
  memoria.set(chave, texto);
}

export async function removeMonitor(hostname: string): Promise<void> {
  const cliente = obtemRedis();
  if (cliente) {
    try {
      await cliente.del(chaveMonitor(hostname), chaveResultado(hostname));
      return;
    } catch {
      return;
    }
  }
  memoria.delete(chaveMonitor(hostname));
  memoria.delete(chaveResultado(hostname));
}

export async function leMonitor(hostname: string): Promise<Monitor | null> {
  const cliente = obtemRedis();
  if (cliente) {
    try {
      const texto = await cliente.get<string>(chaveMonitor(hostname));
      return texto ? parseiaMonitor(texto) : null;
    } catch {
      return null;
    }
  }
  const texto = memoria.get(chaveMonitor(hostname));
  return texto ? parseiaMonitor(texto) : null;
}

export async function listaMonitores(): Promise<Monitor[]> {
  const cliente = obtemRedis();
  if (cliente) {
    try {
      const monitores: Monitor[] = [];
      let cursor = "0";
      do {
        const pagina = await cliente.scan(cursor, { match: `${PREFIXO_MONITOR}*`, count: 100 });
        cursor = pagina[0];
        for (const chave of pagina[1]) {
          if (!ehChaveMonitor(chave)) continue;
          const texto = await cliente.get<string>(chave);
          if (texto) {
            const monitor = parseiaMonitor(texto);
            if (monitor) monitores.push(monitor);
          }
        }
      } while (cursor !== "0");
      return monitores;
    } catch {
      return [];
    }
  }
  const monitores: Monitor[] = [];
  for (const [chave, texto] of memoria) {
    if (!ehChaveMonitor(chave)) continue;
    const monitor = parseiaMonitor(texto);
    if (monitor) monitores.push(monitor);
  }
  return monitores;
}

export async function salvaUltimoResultado(hostname: string, resultado: ResultadoCheck): Promise<void> {
  const cliente = obtemRedis();
  const chave = chaveResultado(hostname);
  const texto = JSON.stringify(resultado);
  if (cliente) {
    try {
      await cliente.set(chave, texto, { ex: Math.ceil(TTL_RESULTADO_MS / 1000) });
      return;
    } catch {
      return;
    }
  }
  memoria.set(chave, texto);
}

export async function leUltimoResultado(hostname: string): Promise<ResultadoCheck | null> {
  const cliente = obtemRedis();
  if (cliente) {
    try {
      const texto = await cliente.get<string>(chaveResultado(hostname));
      return texto ? (JSON.parse(texto) as ResultadoCheck) : null;
    } catch {
      return null;
    }
  }
  const texto = memoria.get(chaveResultado(hostname));
  return texto ? (JSON.parse(texto) as ResultadoCheck) : null;
}

export type ItensPioraram = Array<{ categoriaId: string; itemId: string }>;

export type ComparacaoResultados = {
  scoreCaiu: boolean;
  itensPioraram: ItensPioraram;
};

export function comparaResultados(anterior: ResultadoCheck, novo: ResultadoCheck): ComparacaoResultados {
  const itensPioraram: ItensPioraram = [];

  for (const categoriaNova of novo.categorias) {
    const categoriaAntiga = anterior.categorias.find(c => c.id === categoriaNova.id);
    if (!categoriaAntiga) continue;
    for (const itemNovo of categoriaNova.itens) {
      if (itemNovo.status !== "falha") continue;
      const itemAntigo = categoriaAntiga.itens.find(i => i.id === itemNovo.id);
      if (itemAntigo?.status === "ok") {
        itensPioraram.push({ categoriaId: categoriaNova.id, itemId: itemNovo.id });
      }
    }
  }

  return { scoreCaiu: novo.score < anterior.score, itensPioraram };
}