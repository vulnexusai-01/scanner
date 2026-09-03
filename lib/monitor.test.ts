import { describe, expect, it } from "vitest";
import {
  adicionaMonitor,
  comparaResultados,
  geraToken,
  hashToken,
  leMonitor,
  leUltimoResultado,
  listaMonitores,
  removeMonitor,
  salvaUltimoResultado,
  validaToken,
  type Monitor,
} from "./monitor";
import type { Categoria, ResultadoCheck } from "./verificador";

const tokenInicial = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const tokenHashInicial = hashToken(tokenInicial);

const monitor: Monitor = {
  url: "https://exemplo.com/",
  hostname: "exemplo.com",
  webhookUrl: "https://discord.com/api/webhooks/123",
  webhookTipo: "discord",
  cron: "0 6 * * *",
  criadoEm: "2026-08-13T00:00:00.000Z",
  tokenHash: tokenHashInicial,
};

function categoria(id: string, itens: Array<{ id: string; status: "ok" | "aviso" | "falha" }>): Categoria {
  return { id, peso: 10, itens: itens.map(i => ({ id: i.id, status: i.status })) };
}

function resultado(score: number, categorias: Categoria[]): ResultadoCheck {
  return {
    url: "https://exemplo.com/",
    urlFinal: "https://exemplo.com/",
    statusCode: 200,
    categorias,
    score,
    grade: "B",
    timestamp: "2026-08-13T00:00:00.000Z",
  };
}

describe("monitor (autenticação por token)", () => {
  it("gera token hexadecimal com 64 caracteres (32 bytes)", () => {
    const token = geraToken();
    expect(typeof token).toBe("string");
    expect(token).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
  });

  it("gera hash SHA-256 consistente", () => {
    const token = "teste-token-123";
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("valida token correto e rejeita incorreto", () => {
    const token = geraToken();
    const hash = hashToken(token);
    expect(validaToken(token, hash)).toBe(true);
    expect(validaToken("token-errado", hash)).toBe(false);
    expect(validaToken("", hash)).toBe(false);
  });
});

describe("monitor (fallback em memória)", () => {
  it("adiciona e lê um monitor", async () => {
    await adicionaMonitor(monitor);
    await expect(leMonitor("exemplo.com")).resolves.toEqual(monitor);
  });

  it("retorna null para monitor inexistente", async () => {
    await expect(leMonitor("inexistente.com")).resolves.toBeNull();
  });

  it("remove o monitor e seu resultado", async () => {
    await adicionaMonitor(monitor);
    await salvaUltimoResultado("exemplo.com", resultado(80, []));
    await removeMonitor("exemplo.com");
    await expect(leMonitor("exemplo.com")).resolves.toBeNull();
    await expect(leUltimoResultado("exemplo.com")).resolves.toBeNull();
  });

  it("lista apenas monitores, ignorando resultados salvos", async () => {
    await salvaUltimoResultado("sem-monitor.com", resultado(80, []));
    await adicionaMonitor(monitor);
    const lista = await listaMonitores();
    expect(lista.map(m => m.hostname)).toEqual(["exemplo.com"]);
  });

  it("salva e lê o último resultado", async () => {
    const r = resultado(62, [categoria("https", [{ id: "https-ativo", status: "ok" }])]);
    await salvaUltimoResultado("exemplo.com", r);
    await expect(leUltimoResultado("exemplo.com")).resolves.toEqual(r);
  });

  it("retorna null quando não há resultado salvo", async () => {
    await expect(leUltimoResultado("sem-resultado.com")).resolves.toBeNull();
  });
});

describe("comparaResultados", () => {
  const ok = [{ id: "hsts", status: "ok" as const }];
  const falha = [{ id: "hsts", status: "falha" as const }];

  it("detecta queda de score", () => {
    const anterior = resultado(80, [categoria("headers", ok)]);
    const novo = resultado(60, [categoria("headers", ok)]);
    const comparacao = comparaResultados(anterior, novo);
    expect(comparacao.scoreCaiu).toBe(true);
    expect(comparacao.itensPioraram).toEqual([]);
  });

  it("não sinaliza quando o score subiu", () => {
    const anterior = resultado(60, [categoria("headers", ok)]);
    const novo = resultado(80, [categoria("headers", ok)]);
    expect(comparaResultados(anterior, novo).scoreCaiu).toBe(false);
  });

  it("não sinaliza queda com score igual", () => {
    const anterior = resultado(70, [categoria("headers", falha)]);
    const novo = resultado(70, [categoria("headers", falha)]);
    expect(comparaResultados(anterior, novo).scoreCaiu).toBe(false);
  });

  it("detecta item que passou de ok para falha", () => {
    const anterior = resultado(70, [categoria("headers", ok)]);
    const novo = resultado(60, [categoria("headers", falha)]);
    const comparacao = comparaResultados(anterior, novo);
    expect(comparacao.itensPioraram).toEqual([{ categoriaId: "headers", itemId: "hsts" }]);
  });

  it("não sinaliza aviso para falha", () => {
    const anterior = resultado(70, [categoria("dns", [{ id: "dkim", status: "aviso" }])]);
    const novo = resultado(65, [categoria("dns", [{ id: "dkim", status: "falha" }])]);
    expect(comparaResultados(anterior, novo).itensPioraram).toEqual([]);
  });

  it("não sinaliza falha para ok (melhora)", () => {
    const anterior = resultado(50, [categoria("headers", falha)]);
    const novo = resultado(80, [categoria("headers", ok)]);
    expect(comparaResultados(anterior, novo).itensPioraram).toEqual([]);
  });

  it("não sinaliza itens sem correspondente no resultado anterior", () => {
    const anterior = resultado(70, [categoria("headers", ok)]);
    const novo = resultado(70, [
      categoria("headers", ok),
      categoria("arquivos", [{ id: "env", status: "falha" }]),
    ]);
    expect(comparaResultados(anterior, novo).itensPioraram).toEqual([]);
  });

  it("detecta múltiplos itens piorados em categorias distintas", () => {
    const anterior = resultado(80, [
      categoria("headers", ok),
      categoria("dns", [{ id: "spf", status: "ok" }]),
    ]);
    const novo = resultado(40, [
      categoria("headers", falha),
      categoria("dns", [{ id: "spf", status: "falha" }]),
    ]);
    const comparacao = comparaResultados(anterior, novo);
    expect(comparacao.itensPioraram).toEqual([
      { categoriaId: "headers", itemId: "hsts" },
      { categoriaId: "dns", itemId: "spf" },
    ]);
    expect(comparacao.scoreCaiu).toBe(true);
  });
});