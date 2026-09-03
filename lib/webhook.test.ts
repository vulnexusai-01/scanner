import { afterEach, describe, expect, it, vi } from "vitest";
import { enviaAlerta, montaMensagem, type AlertaPayload } from "./webhook";
import type { Monitor } from "./monitor";
import type { ResultadoCheck } from "./verificador";

const monitor: Monitor = {
  url: "https://exemplo.com/",
  hostname: "exemplo.com",
  webhookUrl: "https://discord.com/api/webhooks/123",
  webhookTipo: "discord",
  cron: "0 6 * * *",
  criadoEm: "2026-08-13T00:00:00.000Z",
  tokenHash: "0".repeat(64),
};

function resultado(score: number, grade: ResultadoCheck["grade"]): ResultadoCheck {
  return {
    url: "https://exemplo.com/",
    urlFinal: "https://exemplo.com/",
    statusCode: 200,
    categorias: [
      {
        id: "headers",
        peso: 30,
        itens: [
          { id: "hsts", status: "ok" },
          { id: "csp", status: "falha" },
        ],
      },
      {
        id: "arquivos",
        peso: 15,
        itens: [{ id: "env", status: "falha" }],
      },
    ],
    score,
    grade,
    timestamp: "2026-08-13T00:00:00.000Z",
  };
}

function payload(parcial: Partial<AlertaPayload> = {}): AlertaPayload {
  return {
    monitor,
    resultado: resultado(55, "C"),
    anterior: resultado(70, "B"),
    itensPioraram: [{ categoriaId: "arquivos", itemId: "env" }],
    ...parcial,
  };
}

describe("montaMensagem", () => {
  it("inclui hostname, score novo, score anterior e a variação", () => {
    const mensagem = montaMensagem(payload());
    expect(mensagem).toContain("exemplo.com");
    expect(mensagem).toContain("55 (C)");
    expect(mensagem).toContain("70 (B)");
    expect(mensagem).toContain("-15");
  });

  it("lista os itens que pioraram com o rótulo da categoria", () => {
    const mensagem = montaMensagem(payload());
    expect(mensagem).toContain("Problemas novos:");
    expect(mensagem).toContain("[Arquivos Sensíveis]");
    expect(mensagem).toContain("Arquivo .env exposto");
  });

  it("funciona sem resultado anterior (primeira execução)", () => {
    const mensagem = montaMensagem(payload({ anterior: undefined }));
    expect(mensagem).toContain("55 (C)");
    expect(mensagem).not.toContain("70 (B)");
  });

  it("usa o rótulo padrão quando o id não é conhecido", () => {
    const mensagem = montaMensagem(
      payload({ itensPioraram: [{ categoriaId: "categoria-x", itemId: "item-y" }] })
    );
    expect(mensagem).toContain("[categoria-x]");
    expect(mensagem).toContain("item-y");
  });
});

describe("enviaAlerta", () => {
  const fetchMock = vi.fn();

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function fixaFetch(resposta: Response | Error): void {
    fetchMock.mockImplementation(async () => {
      if (resposta instanceof Error) throw resposta;
      return resposta;
    });
    vi.stubGlobal("fetch", fetchMock);
  }

  it("envia corpo {content} para Discord", async () => {
    fixaFetch(new Response("{}", { status: 200 }));
    const resultado = await enviaAlerta(payload());
    expect(resultado.enviado).toBe(true);
    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { content: string };
    expect(corpo.content).toContain("exemplo.com");
    expect(fetchMock.mock.calls[0]![1]!.method).toBe("POST");
  });

  it("envia corpo {text} para Slack", async () => {
    fixaFetch(new Response("ok", { status: 200 }));
    const resultado = await enviaAlerta(payload({ monitor: { ...monitor, webhookTipo: "slack" } }));
    expect(resultado.enviado).toBe(true);
    const corpo = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as { text: string };
    expect(corpo.text).toContain("exemplo.com");
  });

  it("marca como não enviado quando o webhook responde erro", async () => {
    fixaFetch(new Response("erro", { status: 500 }));
    const resultado = await enviaAlerta(payload());
    expect(resultado.enviado).toBe(false);
    expect(resultado.erro).toBe("HTTP 500");
  });

  it("não lança exceção quando o fetch falha", async () => {
    fixaFetch(new Error("rede indisponível"));
    const resultado = await enviaAlerta(payload());
    expect(resultado.enviado).toBe(false);
    expect(resultado.erro).toBe("rede indisponível");
  });
});