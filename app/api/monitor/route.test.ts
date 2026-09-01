import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, DELETE } from "./route";
import { leMonitor, removeMonitor } from "@/lib/monitor";

vi.mock("@/lib/qstash", () => ({
  agendaMonitoramento: vi.fn().mockResolvedValue({}),
  cancelaMonitoramento: vi.fn().mockResolvedValue({}),
  cronValido: vi.fn().mockReturnValue(true),
  CRON_PADRAO: "0 6 * * *",
  QStashErro: class QStashErro extends Error {
    codigo: string;
    constructor(mensagem: string, codigo: string) {
      super(mensagem);
      this.codigo = codigo;
    }
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  checaRateLimit: vi.fn().mockResolvedValue({ permitido: true, retryEmSegundos: 0 }),
  ipDaRequisicao: vi.fn().mockReturnValue("127.0.0.1"),
}));

function criaRequest(url: string, metodo: "POST" | "DELETE", body?: unknown): NextRequest {
  return new NextRequest(new URL(url, "http://localhost:3000"), {
    method: metodo,
    headers: {
      "content-type": "application/json",
      "content-length": body ? String(JSON.stringify(body).length) : "0",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("API /api/monitor - Autenticação por Token de Dono", () => {
  const dominio = "teste-seguranca.com";
  const urlSite = `https://${dominio}`;
  const webhookUrl = "https://discord.com/api/webhooks/123/abc";

  beforeEach(async () => {
    await removeMonitor(dominio);
  });

  it("criação gera token em texto puro e salva tokenHash correspondente", async () => {
    const req = criaRequest("/api/monitor", "POST", {
      url: urlSite,
      webhookUrl,
      webhookTipo: "discord",
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const dados = await res.json();
    expect(dados.ok).toBe(true);
    expect(dados.hostname).toBe(dominio);
    expect(typeof dados.token).toBe("string");
    expect(dados.token).toHaveLength(64);
    expect(dados.aviso).toContain("Guarde este token");

    const salvo = await leMonitor(dominio);
    expect(salvo).not.toBeNull();
    expect(salvo?.hostname).toBe(dominio);
    expect(salvo?.tokenHash).toBeDefined();
    expect(salvo?.tokenHash).not.toBe(dados.token); // Nunca armazena em texto puro
  });

  it("segunda tentativa de POST no mesmo hostname sem token retorna 409", async () => {
    // 1. Criação inicial
    const req1 = criaRequest("/api/monitor", "POST", {
      url: urlSite,
      webhookUrl,
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(201);

    // 2. Tentativa de sequestro/sobrescrita sem token
    const req2 = criaRequest("/api/monitor", "POST", {
      url: urlSite,
      webhookUrl: "https://discord.com/api/webhooks/hacker/xyz",
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(409);

    const erro = await res2.json();
    expect(erro.codigo).toBe("monitor-ja-existe");

    // Verifica que o monitor original não foi alterado
    const salvo = await leMonitor(dominio);
    expect(salvo?.webhookUrl).toBe(webhookUrl);
  });

  it("POST com token correto atualiza o monitor com sucesso", async () => {
    // 1. Criação inicial
    const req1 = criaRequest("/api/monitor", "POST", {
      url: urlSite,
      webhookUrl,
    });
    const res1 = await POST(req1);
    const dados1 = await res1.json();
    const tokenValido = dados1.token;

    // 2. Atualização legítima com o token
    const novoWebhook = "https://discord.com/api/webhooks/novo/123";
    const req2 = criaRequest("/api/monitor", "POST", {
      url: urlSite,
      webhookUrl: novoWebhook,
      token: tokenValido,
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);

    const dados2 = await res2.json();
    expect(dados2.ok).toBe(true);

    const salvo = await leMonitor(dominio);
    expect(salvo?.webhookUrl).toBe(novoWebhook);
  });

  it("DELETE sem token ou com token errado retorna 403 e não remove o monitor", async () => {
    // 1. Cria monitor
    const reqCriar = criaRequest("/api/monitor", "POST", {
      url: urlSite,
      webhookUrl,
    });
    await POST(reqCriar);

    // 2. Tentativa de DELETE sem token
    const reqSemToken = criaRequest("/api/monitor", "DELETE", {
      url: urlSite,
    });
    const resSemToken = await DELETE(reqSemToken);
    expect(resSemToken.status).toBe(403);
    const erroSemToken = await resSemToken.json();
    expect(erroSemToken.codigo).toBe("token-invalido");

    // Monitor continua existindo
    expect(await leMonitor(dominio)).not.toBeNull();

    // 3. Tentativa de DELETE com token incorreto
    const reqTokenErrado = criaRequest("/api/monitor", "DELETE", {
      url: urlSite,
      token: "token-completamente-errado-1234567890abcdef",
    });
    const resTokenErrado = await DELETE(reqTokenErrado);
    expect(resTokenErrado.status).toBe(403);
    const erroTokenErrado = await resTokenErrado.json();
    expect(erroTokenErrado.codigo).toBe("token-invalido");

    // Monitor continua existindo
    expect(await leMonitor(dominio)).not.toBeNull();
  });

  it("DELETE com token correto remove o monitor com sucesso", async () => {
    // 1. Cria monitor
    const reqCriar = criaRequest("/api/monitor", "POST", {
      url: urlSite,
      webhookUrl,
    });
    const resCriar = await POST(reqCriar);
    const { token } = await resCriar.json();

    // 2. DELETE com o token correto
    const reqDelete = criaRequest("/api/monitor", "DELETE", {
      url: urlSite,
      token,
    });
    const resDelete = await DELETE(reqDelete);
    expect(resDelete.status).toBe(200);

    const dadosDelete = await resDelete.json();
    expect(dadosDelete.ok).toBe(true);
    expect(dadosDelete.hostname).toBe(dominio);

    // Monitor foi removido
    expect(await leMonitor(dominio)).toBeNull();
  });
});
