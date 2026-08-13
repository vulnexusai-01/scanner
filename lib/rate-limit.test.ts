import { afterEach, describe, expect, it, vi } from "vitest";
import { checaRateLimit, ipDaRequisicao } from "./rate-limit";

const JANELA_MS = 5 * 60 * 1000;

describe("checaRateLimit (fallback em memória)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite as primeiras requisições", async () => {
    for (let i = 0; i < 9; i++) {
      const resultado = await checaRateLimit("192.0.2.10", "verificar");
      expect(resultado.permitido).toBe(true);
    }
  });

  it("bloqueia a requisição que excede o limite", async () => {
    for (let i = 0; i < 10; i++) {
      await checaRateLimit("192.0.2.20", "verificar");
    }
    const bloqueado = await checaRateLimit("192.0.2.20", "verificar");
    expect(bloqueado.permitido).toBe(false);
    expect(bloqueado.retryEmSegundos).toBeGreaterThan(0);
  });

  it("não bloqueia IPs diferentes", async () => {
    for (let i = 0; i < 10; i++) {
      await checaRateLimit("192.0.2.30", "verificar");
    }
    await expect(checaRateLimit("192.0.2.31", "verificar")).resolves.toEqual({ permitido: true, retryEmSegundos: 0 });
  });

  it("libera o IP após expirar a janela", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 10; i++) {
      await checaRateLimit("192.0.2.40", "verificar");
    }
    const bloqueado = await checaRateLimit("192.0.2.40", "verificar");
    expect(bloqueado.permitido).toBe(false);

    vi.advanceTimersByTime(JANELA_MS + 1);
    await expect(checaRateLimit("192.0.2.40", "verificar")).resolves.toEqual({ permitido: true, retryEmSegundos: 0 });
  });

  it("aplica limite maior para o badge", async () => {
    for (let i = 0; i < 15; i++) {
      const resultado = await checaRateLimit("192.0.2.50", "badge");
      expect(resultado.permitido).toBe(true);
    }
  });

  it("mantém contadores independentes entre contextos", async () => {
    for (let i = 0; i < 10; i++) {
      await checaRateLimit("192.0.2.60", "verificar");
    }
    const bloqueadoNoVerificar = await checaRateLimit("192.0.2.60", "verificar");
    expect(bloqueadoNoVerificar.permitido).toBe(false);

    await expect(checaRateLimit("192.0.2.60", "badge")).resolves.toEqual({ permitido: true, retryEmSegundos: 0 });
  });
});

describe("ipDaRequisicao", () => {
  it("usa o primeiro IP de x-forwarded-for", () => {
    const req = new Request("https://exemplo.com", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(ipDaRequisicao(req)).toBe("203.0.113.1");
  });

  it("usa x-real-ip quando não há x-forwarded-for", () => {
    const req = new Request("https://exemplo.com", {
      headers: { "x-real-ip": "203.0.113.2" },
    });
    expect(ipDaRequisicao(req)).toBe("203.0.113.2");
  });

  it("retorna 'desconhecido' sem headers de IP", () => {
    const req = new Request("https://exemplo.com");
    expect(ipDaRequisicao(req)).toBe("desconhecido");
  });
});
