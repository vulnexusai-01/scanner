import { describe, expect, it, vi, beforeEach } from "vitest";
import type { LookupAddress } from "node:dns";
import { isIPPrivado, normalizaUrl, resolveHostPublico, statusDosItens, VerificadorErro, type ItemCheck } from "./verificador";

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: lookupMock,
    resolveTxt: vi.fn(),
    resolveCaa: vi.fn(),
  },
}));

describe("isIPPrivado", () => {
  it("bloqueia IPv4 privados conhecidos", () => {
    expect(isIPPrivado("10.0.0.1")).toBe(true);
    expect(isIPPrivado("127.0.0.1")).toBe(true);
    expect(isIPPrivado("169.254.10.10")).toBe(true);
    expect(isIPPrivado("172.16.0.1")).toBe(true);
    expect(isIPPrivado("172.31.255.255")).toBe(true);
    expect(isIPPrivado("192.168.1.1")).toBe(true);
  });

  it("bloqueia 0.0.0.0/8, inclusive o endereço puro", () => {
    expect(isIPPrivado("0.0.0.0")).toBe(true);
    expect(isIPPrivado("0.1.2.3")).toBe(true);
    expect(isIPPrivado("0.255.255.255")).toBe(true);
  });

  it("bloqueia a faixa CGNAT 100.64.0.0/10", () => {
    expect(isIPPrivado("100.64.0.1")).toBe(true);
    expect(isIPPrivado("100.100.100.100")).toBe(true);
    expect(isIPPrivado("100.127.255.255")).toBe(true);
    expect(isIPPrivado("100.128.0.1")).toBe(false);
    expect(isIPPrivado("100.63.255.255")).toBe(false);
  });

  it("libera IPv4 públicos", () => {
    expect(isIPPrivado("8.8.8.8")).toBe(false);
    expect(isIPPrivado("1.1.1.1")).toBe(false);
    expect(isIPPrivado("172.32.0.1")).toBe(false);
  });

  it("bloqueia loopback e unique local em IPv6", () => {
    expect(isIPPrivado("::1")).toBe(true);
    expect(isIPPrivado("fc00::1")).toBe(true);
    expect(isIPPrivado("fd12:3456:789a::1")).toBe(true);
  });

  it("bloqueia toda a faixa link-local fe80::/10 (fe80-febf)", () => {
    expect(isIPPrivado("fe80::1")).toBe(true);
    expect(isIPPrivado("fe8f::1")).toBe(true);
    expect(isIPPrivado("fe90::1")).toBe(true);
    expect(isIPPrivado("fe9f::1")).toBe(true);
    expect(isIPPrivado("fea0::1")).toBe(true);
    expect(isIPPrivado("feaf::1")).toBe(true);
    expect(isIPPrivado("feb0::1")).toBe(true);
    expect(isIPPrivado("febf::1")).toBe(true);
    expect(isIPPrivado("fec0::1")).toBe(false);
  });

  it("bloqueia IPv6 mapeado de IPv4 (::ffff:0:0/96)", () => {
    expect(isIPPrivado("::ffff:192.168.1.1")).toBe(true);
    expect(isIPPrivado("::ffff:0:10.0.0.1")).toBe(true);
    expect(isIPPrivado("::ffff:0:0:127.0.0.1")).toBe(true);
    expect(isIPPrivado("::ffff:8.8.8.8")).toBe(false);
    expect(isIPPrivado("::ffff:0:100.64.0.1")).toBe(true);
  });

  it("bloqueia IPv4 mapeado na forma hexadecimal (saída do parser de URL)", () => {
    expect(isIPPrivado("::ffff:a00:1")).toBe(true);
    expect(isIPPrivado("::ffff:0:a00:1")).toBe(true);
    expect(isIPPrivado("::ffff:7f00:1")).toBe(true);
    expect(isIPPrivado("::ffff:6440:1")).toBe(true);
    expect(isIPPrivado("::ffff:808:808")).toBe(false);
    expect(isIPPrivado("::ffff:0:808:808")).toBe(false);
  });

  it("bloqueia IPv6 NAT64 (64:ff9b::/96) com IPv4 embutido", () => {
    expect(isIPPrivado("64:ff9b::192.168.1.1")).toBe(true);
    expect(isIPPrivado("64:ff9b::10.0.0.1")).toBe(true);
    expect(isIPPrivado("64:ff9b::8.8.8.8")).toBe(false);
    expect(isIPPrivado("64:ff9b::a00:1")).toBe(true);
    expect(isIPPrivado("64:ff9b::808:808")).toBe(false);
  });

  it("é case-insensitive para IPv6", () => {
    expect(isIPPrivado("::FFFF:192.168.1.1")).toBe(true);
    expect(isIPPrivado("FE80::1")).toBe(true);
    expect(isIPPrivado("64:FF9B::10.0.0.1")).toBe(true);
  });

  it("libera IPv6 públicos", () => {
    expect(isIPPrivado("2001:4860:4860::8888")).toBe(false);
    expect(isIPPrivado("2606:4700:4700::1111")).toBe(false);
  });

  it("retorna false para valores que não são IP", () => {
    expect(isIPPrivado("example.com")).toBe(false);
    expect(isIPPrivado("")).toBe(false);
  });
});

describe("normalizaUrl", () => {
  it("adiciona https:// quando o protocolo está ausente", () => {
    expect(normalizaUrl("example.com").href).toBe("https://example.com/");
  });

  it("mantém o protocolo informado", () => {
    expect(normalizaUrl("http://example.com").href).toBe("http://example.com/");
    expect(normalizaUrl("https://example.com/pagina").href).toBe("https://example.com/pagina");
  });

  it("ignora espaços em branco nas bordas", () => {
    expect(normalizaUrl("  example.com  ").href).toBe("https://example.com/");
  });

  it("rejeita protocolos que não sejam http/https", () => {
    expect(() => normalizaUrl("ftp://example.com")).toThrowError(VerificadorErro);
    try {
      normalizaUrl("javascript:alert(1)");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(VerificadorErro);
      expect((err as VerificadorErro).codigo).toBe("protocolo-invalido");
    }
  });

  it("rejeita URLs sem hostname", () => {
    try {
      normalizaUrl("");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(VerificadorErro);
      expect((err as VerificadorErro).codigo).toBe("url-invalida");
    }
  });
});

describe("resolveHostPublico", () => {
  beforeEach(() => {
    lookupMock.mockReset();
  });

  it("aceita IP público direto", async () => {
    await expect(resolveHostPublico(new URL("https://8.8.8.8"))).resolves.toBe("8.8.8.8");
  });

  it("rejeita IP privado direto", async () => {
    try {
      await resolveHostPublico(new URL("https://192.168.1.1"));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(VerificadorErro);
      expect((err as VerificadorErro).codigo).toBe("ip-privado");
    }
  });

  it("rejeita IPv6 mapeado de IPv4 privado", async () => {
    try {
      await resolveHostPublico(new URL("https://[::ffff:10.0.0.1]"));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(VerificadorErro);
      expect((err as VerificadorErro).codigo).toBe("ip-privado");
    }
  });

  it("rejeita domínio que resolve para endereço privado", async () => {
    lookupMock.mockResolvedValue([{ address: "10.0.0.1", family: 4 }] as LookupAddress[]);
    try {
      await resolveHostPublico(new URL("https://exemplo-interno.com"));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(VerificadorErro);
      expect((err as VerificadorErro).codigo).toBe("dominio-privado");
    }
  });

  it("rejeita domínio que resolve para IPv6 mapeado privado", async () => {
    lookupMock.mockResolvedValue([{ address: "::ffff:192.168.1.1", family: 6 }] as LookupAddress[]);
    try {
      await resolveHostPublico(new URL("https://exemplo-interno.com"));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(VerificadorErro);
      expect((err as VerificadorErro).codigo).toBe("dominio-privado");
    }
  });

  it("retorna o primeiro IPv4 de um domínio público", async () => {
    lookupMock.mockResolvedValue([
      { address: "2606:4700:4700::1111", family: 6 },
      { address: "1.1.1.1", family: 4 },
    ] as LookupAddress[]);
    await expect(resolveHostPublico(new URL("https://example.com"))).resolves.toBe("1.1.1.1");
  });

  it("usa o primeiro endereço quando não há IPv4", async () => {
    lookupMock.mockResolvedValue([{ address: "2606:4700:4700::1111", family: 6 }] as LookupAddress[]);
    await expect(resolveHostPublico(new URL("https://example.com"))).resolves.toBe("2606:4700:4700::1111");
  });

  it("rejeita domínio que não resolve", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    try {
      await resolveHostPublico(new URL("https://nao-existe.inv"));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(VerificadorErro);
      expect((err as VerificadorErro).codigo).toBe("dominio-nao-resolve");
    }
  });
});

describe("statusDosItens", () => {
  function itens(...status: Array<ItemCheck["status"]>): ItemCheck[] {
    return status.map((s, i) => ({ id: `item-${i}`, status: s }));
  }

  it("retorna 0 para lista vazia", () => {
    expect(statusDosItens([])).toBe(0);
  });

  it("retorna 100 quando todos estão ok", () => {
    expect(statusDosItens(itens("ok", "ok", "ok"))).toBe(100);
  });

  it("ignora itens em aviso no cálculo", () => {
    expect(statusDosItens(itens("ok", "aviso", "ok"))).toBe(100);
  });

  it("calcula a porcentagem corretamente", () => {
    expect(statusDosItens(itens("ok", "falha"))).toBe(50);
    expect(statusDosItens(itens("ok", "falha", "falha"))).toBe(33);
    expect(statusDosItens(itens("falha", "falha"))).toBe(0);
  });

  it("retorna 100 quando só há avisos", () => {
    expect(statusDosItens(itens("aviso", "aviso"))).toBe(100);
  });
});
