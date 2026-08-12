import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";

export type StatusItem = "ok" | "aviso" | "falha";

export type ItemCheck = {
  id: string;
  titulo: string;
  descricao: string;
  status: StatusItem;
  detalhe?: string;
  dica?: string;
};

export type Categoria = {
  id: string;
  titulo: string;
  peso: number;
  itens: ItemCheck[];
};

export type ResultadoCheck = {
  url: string;
  urlFinal: string;
  statusCode: number | null;
  categorias: Categoria[];
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  timestamp: string;
  servidor?: string;
};

function isIPPrivado(host: string): boolean {
  const ip = net.isIP(host);
  if (ip === 4) {
    const partes = host.split(".").map(Number);
    if (partes[0] === 10) return true;
    if (partes[0] === 127) return true;
    if (partes[0] === 169 && partes[1] === 254) return true;
    if (partes[0] === 172 && partes[1] >= 16 && partes[1] <= 31) return true;
    if (partes[0] === 192 && partes[1] === 168) return true;
    return false;
  }
  return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe8");
}

function normalizaUrl(input: string): URL {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Somente URLs http/https são aceitas.");
  }
  if (!u.hostname) throw new Error("URL inválida.");
  return u;
}

async function validaHost(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isIPPrivado(host)) throw new Error("Endereços privados não são permitidos.");
  } else {
    const addrs = await dns.lookup(host, { all: true });
    const invalidos = addrs.filter(a => isIPPrivado(a.address));
    if (invalidos.length > 0) {
      throw new Error("O domínio resolve para um endereço privado — não permitido.");
    }
  }
}

async function coletaResponses(url: URL, limite = 5): Promise<{ respostas: Response[]; final: Response }> {
  let atual = url;
  const respostas: Response[] = [];
  let final!: Response;
  for (let i = 0; i <= limite; i++) {
    const res = await fetch(atual, {
      redirect: "manual",
      method: "HEAD",
      headers: { "user-agent": "VerificaSeguranca/1.0 (+scanner de segurança)" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      respostas.push(res);
      const next = new URL(res.headers.get("location")!, atual);
      if (next.href === atual.href) break;
      atual = next;
    } else {
      final = res;
      break;
    }
  }
  if (!final) {
    throw new Error("Redirecionamento em loop ou limite excedido.");
  }
  return { respostas, final };
}

type InfoTls = {
  host: string;
  emissor: string;
  valido: boolean;
  autoAssinado: boolean;
  expiraEm: string;
  diasRestantes: number;
  protocolo: string;
  tls1_0: boolean;
  tls1_1: boolean;
};

function tentaProtocolo(host: string, minVersion: tls.SecureVersion, maxVersion: tls.SecureVersion): Promise<boolean> {
  return new Promise(resolve => {
    const socket = tls.connect({ host, port: 443, servername: host, minVersion, maxVersion, timeout: 6000 });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 7000);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      socket.end();
      resolve(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    socket.once("timeout", () => {
      socket.destroy();
      clearTimeout(timer);
      resolve(false);
    });
  });
}

function checaTls(host: string): Promise<InfoTls> {
  return new Promise(resolve => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 10000 });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({
        host,
        emissor: "desconhecido",
        valido: false,
        autoAssinado: true,
        expiraEm: "",
        diasRestantes: 0,
        protocolo: "desconhecido",
        tls1_0: false,
        tls1_1: false,
      });
    }, 12000);

    socket.once("secureConnect", async () => {
      clearTimeout(timeout);
      const cert = socket.getPeerCertificate();
      const protocolo = socket.getProtocol() || "desconhecido";
      const tls1_0 = await tentaProtocolo(host, "TLSv1", "TLSv1");
      const tls1_1 = await tentaProtocolo(host, "TLSv1.1", "TLSv1.1");
      socket.end();
      if (!cert || !cert.subject) {
        resolve({
          host,
          emissor: "desconhecido",
          valido: false,
          autoAssinado: socket.authorizationError !== null,
          expiraEm: "",
          diasRestantes: 0,
          protocolo,
          tls1_0,
          tls1_1,
        });
        return;
      }
      resolve({
        host,
        emissor: String(cert.issuer?.O || cert.issuer?.CN || "desconhecido"),
        valido: Boolean(cert.valid_to && !socket.authorizationError && new Date(cert.valid_to) > new Date()),
        autoAssinado: socket.authorizationError !== null,
        expiraEm: cert.valid_to || "",
        diasRestantes: cert.valid_to ? Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000) : 0,
        protocolo,
        tls1_0,
        tls1_1,
      });
    });

    socket.once("error", () => {
      clearTimeout(timeout);
      resolve({
        host,
        emissor: "desconhecido",
        valido: false,
        autoAssinado: true,
        expiraEm: "",
        diasRestantes: 0,
        protocolo: "sem conexão TLS",
        tls1_0: false,
        tls1_1: false,
      });
    });
    socket.once("timeout", () => {
      socket.destroy();
      clearTimeout(timeout);
    });
  });
}

function dominioBase(hostname: string): string {
  return hostname.replace(/^www\./i, "");
}

async function registrosTxt(host: string): Promise<string[]> {
  try {
    const registros = await dns.resolveTxt(host);
    return registros.map(r => r.join("")).filter(Boolean);
  } catch {
    return [];
  }
}

async function checaSpf(host: string): Promise<{ registros: string[]; temSpf: boolean }> {
  const registros = await registrosTxt(host);
  const spf = registros.filter(r => r.toLowerCase().startsWith("v=spf1"));
  return { registros, temSpf: spf.length > 0 };
}

async function checaDmarc(host: string): Promise<{ registros: string[]; temDmarc: boolean }> {
  const registros = await registrosTxt(`_dmarc.${host}`);
  return { registros, temDmarc: registros.length > 0 };
}

const SELETORES_DKIM = ["default", "google", "selector1", "selector2", "k1", "s1", "s2", "mail"];

async function checaDkim(host: string): Promise<{ encontrado: string[]; sucesso: boolean }> {
  const encontrado: string[] = [];
  for (const seletor of SELETORES_DKIM) {
    const registros = await registrosTxt(`${seletor}._domainkey.${host}`);
    if (registros.length > 0) {
      encontrado.push(`${seletor}._domainkey`);
    }
  }
  return { encontrado, sucesso: encontrado.length > 0 };
}

function statusDosItens(itens: ItemCheck[]): number {
  if (itens.length === 0) return 0;
  const pontuados = itens.filter(i => i.status !== "aviso");
  if (pontuados.length === 0) return 100;
  const ok = pontuados.filter(i => i.status === "ok").length;
  return Math.round((ok / pontuados.length) * 100);
}

export async function verificarSite(input: string): Promise<ResultadoCheck> {
  const url = normalizaUrl(input);
  await validaHost(url);

  const { respostas, final } = await coletaResponses(url);

  const redirects = respostas.map(r => ({
    status: r.status,
    de: r.url,
    para: r.headers.get("location") || "",
  }));

  const https = final.url.startsWith("https:");
  const httpParaHttps = https && redirects.some(r => r.de.startsWith("http:") && r.para.startsWith("https:"));

  const cookies: string[] = [];
  for (const res of [final, ...respostas]) {
    const set = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of set) cookies.push(c);
  }

  const hostname = new URL(final.url).hostname;
  const base = dominioBase(hostname);

  const [infoTls, spf, dmarc, dkim] = await Promise.all([
    https ? checaTls(hostname) : Promise.resolve(undefined),
    checaSpf(base),
    checaDmarc(base),
    checaDkim(base),
  ]);

  const categorias: Categoria[] = [];

  // --- HTTPS & Certificado (peso 30) ---
  const itensHttps: ItemCheck[] = [];
  itensHttps.push({
    id: "https-ativo",
    titulo: "Conexão HTTPS",
    descricao: "O site deve responder por HTTPS para criptografar o tráfego.",
    status: https ? "ok" : "falha",
    detalhe: https ? hostname : "O site não ofereceu HTTPS.",
    dica: "Configure um certificado TLS (Let's Encrypt, Cloudflare ou do seu provedor) e sirva o site somente por HTTPS.",
  });
  itensHttps.push({
    id: "redirect-http",
    titulo: "Redirect HTTP → HTTPS",
    descricao: "Visitas por HTTP devem ser redirecionadas automaticamente para HTTPS.",
    status: httpParaHttps ? "ok" : "aviso",
    detalhe: httpParaHttps
      ? `Redirecionamento ${redirects.find(r => r.para.startsWith("https:"))?.status || 301} detectado.`
      : "Nenhum redirecionamento automático detectado na cadeia.",
    dica: "Configure um redirect 301 de http:// para https:// no servidor ou na plataforma de hospedagem.",
  });
  if (infoTls) {
    itensHttps.push({
      id: "certificado",
      titulo: "Certificado SSL",
      descricao: "O certificado deve ser válido, não expirado e emitido por uma autoridade confiável.",
      status: infoTls.valido ? "ok" : "falha",
      detalhe: infoTls.valido
        ? `Válido até ${new Date(infoTls.expiraEm).toLocaleDateString("pt-BR")} (${infoTls.diasRestantes} dias) — ${infoTls.emissor}`
        : infoTls.autoAssinado
          ? "Certificado auto-assinado — navegadores exibirão aviso."
          : `Certificado inválido ou expirado. Emitente: ${infoTls.emissor}`,
      dica: "Renove o certificado antes do vencimento ou troque para um emitido por autoridade confiável (Let's Encrypt).",
    });
    itensHttps.push({
      id: "tls-versao",
      titulo: "Protocolo TLS",
      descricao: "TLS 1.0 e 1.1 são obsoletos e devem ser desativados (deprecados em 2020).",
      status: infoTls.tls1_0 || infoTls.tls1_1 ? "falha" : "ok",
      detalhe: `Negociado: ${infoTls.protocolo}.` + (infoTls.tls1_0 ? " TLS 1.0 ativo." : "") + (infoTls.tls1_1 ? " TLS 1.1 ativo." : ""),
      dica: "Desative TLS 1.0/1.1 e mantenha TLS 1.2 e 1.3 habilitados no servidor.",
    });
  }
  categorias.push({ id: "https", titulo: "HTTPS e Certificado", peso: 30, itens: itensHttps });

  // --- Headers de Segurança (peso 40) ---
  const HEADERS = [
    {
      id: "hsts",
      titulo: "Strict-Transport-Security",
      descricao: "HSTS — força conexões HTTPS e impede downgrade.",
      dica: "Adicione `Strict-Transport-Security: max-age=31536000; includeSubDomains` em todas as respostas HTTPS.",
    },
    {
      id: "csp",
      titulo: "Content-Security-Policy",
      descricao: "CSP — controla quais recursos o navegador pode carregar.",
      dica: "Defina uma política CSP (ex.: `default-src 'self'`) e ajuste conforme os recursos do site.",
    },
    {
      id: "xframe",
      titulo: "X-Frame-Options",
      descricao: "Impede que o site seja exibido dentro de iframes de terceiros (clickjacking).",
      dica: "Adicione `X-Frame-Options: SAMEORIGIN` (ou use a diretiva frame-ancestors do CSP).",
    },
    {
      id: "xcontenttype",
      titulo: "X-Content-Type-Options",
      descricao: "Impede MIME sniffing do navegador.",
      dica: "Adicione `X-Content-Type-Options: nosniff`.",
    },
    {
      id: "referrer",
      titulo: "Referrer-Policy",
      descricao: "Controla quais informações são enviadas no header Referer.",
      dica: "Adicione `Referrer-Policy: strict-origin-when-cross-origin`.",
    },
    {
      id: "permissions",
      titulo: "Permissions-Policy",
      descricao: "Limita acesso a APIs do navegador (câmera, GPS, etc.).",
      dica: "Adicione `Permissions-Policy` restringindo geolocation, camera, microphone, etc.",
    },
  ];

  const itensHeaders: ItemCheck[] = [];
  for (const h of HEADERS) {
    const valor = final.headers.get(h.id === "hsts" ? "Strict-Transport-Security" : h.id === "csp" ? "Content-Security-Policy" : h.id === "xframe" ? "X-Frame-Options" : h.id === "xcontenttype" ? "X-Content-Type-Options" : h.id === "referrer" ? "Referrer-Policy" : "Permissions-Policy");
    const presente = valor !== null && valor.trim() !== "";
    itensHeaders.push({
      id: h.id,
      titulo: h.titulo,
      descricao: h.descricao,
      status: presente ? "ok" : "falha",
      detalhe: presente ? valor! : "Header ausente.",
      dica: h.dica,
    });
  }
  categorias.push({ id: "headers", titulo: "Headers de Segurança", peso: 40, itens: itensHeaders });

  // --- DNS & Email (peso 20) ---
  const itensDns: ItemCheck[] = [];
  itensDns.push({
    id: "spf",
    titulo: "SPF",
    descricao: "SPF — autoriza quais servidores podem enviar email em nome do domínio.",
    status: spf.temSpf ? "ok" : "falha",
    detalhe: spf.temSpf ? `Registro SPF encontrado (${spf.registros.filter(r => r.toLowerCase().startsWith("v=spf1")).length} TXT).` : "Nenhum registro SPF encontrado.",
    dica: "Publique um registro TXT como `v=spf1 include:_spf.provedor ~all` no DNS do domínio.",
  });
  itensDns.push({
    id: "dmarc",
    titulo: "DMARC",
    descricao: "DMARC — política de como tratar emails forjados com seu domínio.",
    status: dmarc.temDmarc ? "ok" : "falha",
    detalhe: dmarc.temDmarc ? "Registro DMARC publicado." : "Nenhum registro DMARC (_dmarc) encontrado.",
    dica: "Publique `_dmarc.<dominio> TXT v=DMARC1; p=none; rua=mailto:seu@email` e depois evolua a política.",
  });
  itensDns.push({
    id: "dkim",
    titulo: "DKIM",
    descricao: "DKIM — assinatura digital que valida a autenticidade dos emails.",
    status: dkim.sucesso ? "ok" : "aviso",
    detalhe: dkim.sucesso ? `Seletor(es) encontrado(s): ${dkim.encontrado.join(", ")}.` : "Nenhum seletor DKIM comum encontrado.",
    dica: "Configure DKIM no seu provedor de email e publique a chave pública em `<seletor>._domainkey.<dominio>`.",
  });
  categorias.push({ id: "dns", titulo: "DNS e Email", peso: 20, itens: itensDns });

  // --- Cookies (peso 10) ---
  const itensCookies: ItemCheck[] = [];
  if (cookies.length === 0) {
    itensCookies.push({
      id: "cookies",
      titulo: "Cookies de sessão",
      descricao: "Cookies de sessão devem usar atributos de segurança.",
      status: "ok",
      detalhe: "Nenhum cookie definido na cadeia de resposta.",
    });
  } else {
    const seguros = cookies.filter(c => /;\s*secure/i.test(c)).length;
    const httpOnly = cookies.filter(c => /;\s*httponly/i.test(c)).length;
    const total = cookies.length;
    itensCookies.push({
      id: "cookies-secure",
      titulo: "Atributo Secure",
      descricao: "Cookies devem ser enviados somente por HTTPS.",
      status: seguros === total ? "ok" : "falha",
      detalhe: `${seguros}/${total} cookies com Secure.`,
      dica: "Adicione `Secure` a todos os cookies.",
    });
    itensCookies.push({
      id: "cookies-httponly",
      titulo: "Atributo HttpOnly",
      descricao: "Impede acesso ao cookie via JavaScript (mitiga XSS).",
      status: httpOnly === total ? "ok" : "falha",
      detalhe: `${httpOnly}/${total} cookies com HttpOnly.`,
      dica: "Adicione `HttpOnly` a cookies que não precisam ser lidos por JavaScript.",
    });
    itensCookies.push({
      id: "cookies-samesite",
      titulo: "SameSite",
      descricao: "Limita envio do cookie em requisições de outros sites (CSRF).",
      status: cookies.every(c => /;\s*samesite/i.test(c)) ? "ok" : "aviso",
      detalhe: `${cookies.filter(c => /;\s*samesite/i.test(c)).length}/${total} cookies com SameSite.`,
      dica: "Adicione `SameSite=Lax` (ou `Strict` quando possível) aos cookies.",
    });
  }
  categorias.push({ id: "cookies", titulo: "Cookies", peso: 10, itens: itensCookies });

  // --- Score ---
  const totalPeso = categorias.reduce((acc, c) => acc + c.peso, 0);
  const score = Math.round(categorias.reduce((acc, c) => acc + statusDosItens(c.itens) * (c.peso / totalPeso), 0));

  let grade: ResultadoCheck["grade"];
  if (score >= 95) grade = "A+";
  else if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 30) grade = "D";
  else grade = "F";

  return {
    url: url.href,
    urlFinal: final.url,
    statusCode: final.status,
    categorias,
    score,
    grade,
    timestamp: new Date().toISOString(),
    servidor: final.headers.get("server") || undefined,
  };
}
