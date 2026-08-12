import dns from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import net from "node:net";
import tls from "node:tls";
import http from "node:http";
import https from "node:https";

export type StatusItem = "ok" | "aviso" | "falha";

export type ItemDados = {
  hostname?: string;
  statusCode?: number;
  valido?: boolean;
  autoAssinado?: boolean;
  expiraEm?: string;
  dias?: number;
  emissor?: string;
  protocolo?: string;
  tls10?: boolean;
  tls11?: boolean;
  valor?: string;
  quantidade?: number;
  seletores?: string;
  ok?: number;
  total?: number;
  caminho?: string;
  registros?: string;
  estado?: string;
};

export type ItemCheck = {
  id: string;
  status: StatusItem;
  dados?: ItemDados;
};

export type Categoria = {
  id: string;
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

export class VerificadorErro extends Error {
  codigo: string;

  constructor(codigo: string, mensagem: string) {
    super(mensagem);
    this.name = "VerificadorErro";
    this.codigo = codigo;
  }
}

const USER_AGENT = "VulnexusAI/1.0 (+scanner de segurança)";
const TIMEOUT_REQUISICAO_MS = 8000;

type RespostaPinada = {
  status: number;
  url: string;
  headers: Headers;
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
    throw new VerificadorErro("protocolo-invalido", "Somente URLs http/https são aceitas.");
  }
  if (!u.hostname) throw new VerificadorErro("url-invalida", "URL inválida.");
  return u;
}

function tinhaProtocolo(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

async function resolveHostPublico(url: URL): Promise<string> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isIPPrivado(host)) throw new VerificadorErro("ip-privado", "Endereços privados não são permitidos.");
    return host;
  }

  let addrs: LookupAddress[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new VerificadorErro("dominio-nao-resolve", "Não foi possível resolver o domínio.");
  }
  if (addrs.length === 0) throw new VerificadorErro("dominio-nao-resolve", "Não foi possível resolver o domínio.");

  const invalidos = addrs.filter(a => isIPPrivado(a.address));
  if (invalidos.length > 0) {
    throw new VerificadorErro("dominio-privado", "O domínio resolve para um endereço privado — não permitido.");
  }

  const ipv4 = addrs.find(a => net.isIP(a.address) === 4);
  return ipv4?.address ?? addrs[0]!.address;
}

function lookupFixado(ip: string): net.LookupFunction {
  return (_hostname, opcoes, callback) => {
    if (opcoes.all) {
      callback(null, [{ address: ip, family: 4 }]);
    } else {
      callback(null, ip, 4);
    }
  };
}

function requisicaoPinada(url: URL, ip: string, timeoutMs = TIMEOUT_REQUISICAO_MS): Promise<RespostaPinada> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "HEAD",
        signal: AbortSignal.timeout(timeoutMs),
        lookup: lookupFixado(ip),
        headers: {
          host: url.host,
          "user-agent": USER_AGENT,
        },
      },
      res => {
        res.resume();
        const headers = new Headers();
        for (const [chave, valor] of Object.entries(res.headers)) {
          if (Array.isArray(valor)) {
            for (const item of valor) headers.append(chave, item);
          } else if (valor !== undefined) {
            headers.set(chave, valor);
          }
        }
        resolve({ status: res.statusCode ?? 0, url: url.href, headers });
      }
    );
    req.on("error", () => {
      reject(new VerificadorErro("conexao-falhou", "Não foi possível conectar ao site (tempo esgotado ou conexão recusada)."));
    });
    req.end();
  });
}

async function testaRedirectHttp(url: URL): Promise<{ status: number; de: string; para: string } | null> {
  const httpUrl = new URL(url.href);
  httpUrl.protocol = "http:";
  try {
    const ip = await resolveHostPublico(httpUrl);
    const res = await requisicaoPinada(httpUrl, ip);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc && loc.toLowerCase().startsWith("https:")) {
      return { status: res.status, de: httpUrl.href, para: loc };
    }
    return null;
  } catch {
    return null;
  }
}

async function coletaResponses(url: URL, limite = 5): Promise<{ respostas: RespostaPinada[]; final: RespostaPinada }> {
  let atual = url;
  const respostas: RespostaPinada[] = [];
  let final!: RespostaPinada;
  for (let i = 0; i <= limite; i++) {
    const ip = await resolveHostPublico(atual);
    const res = await requisicaoPinada(atual, ip);
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
    throw new VerificadorErro("loop-redirect", "Redirecionamento em loop ou limite excedido.");
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

async function checaArquivoSensivel(urlBase: string, caminho: string): Promise<StatusItem> {
  const alvo = new URL(caminho, urlBase);
  try {
    const ip = await resolveHostPublico(alvo);
    const res = await requisicaoPinada(alvo, ip);
    if (res.status >= 200 && res.status < 300) return "falha";
    if (res.status === 401 || res.status === 403) return "ok";
    if (res.status >= 300 && res.status < 400) return "aviso";
    return "ok";
  } catch {
    return "aviso";
  }
}

async function checaRecursoPublico(urlBase: string, caminho: string): Promise<{ status: number; presente: boolean }> {
  const alvo = new URL(caminho, urlBase);
  try {
    const ip = await resolveHostPublico(alvo);
    const res = await requisicaoPinada(alvo, ip);
    return { status: res.status, presente: res.status === 200 };
  } catch {
    return { status: 0, presente: false };
  }
}

async function checaCaa(host: string): Promise<{ registros: Array<{ tag: string; value: string }> }> {
  try {
    const registros = await dns.resolveCaa(host);
    return {
      registros: registros.map(r => {
        const tag = r.issue
          ? "issue"
          : r.issuewild
            ? "issuewild"
            : r.iodef
              ? "iodef"
              : r.contactemail
                ? "contactemail"
                : r.contactphone
                  ? "contactphone"
                  : "desconhecido";
        const value = String(r.issue ?? r.issuewild ?? r.iodef ?? r.contactemail ?? r.contactphone ?? "");
        return { tag, value };
      }),
    };
  } catch {
    return { registros: [] };
  }
}

async function checaSafeBrowsing(url: string): Promise<{ status: StatusItem; estado: string }> {
  const chave = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!chave) {
    return { status: "aviso", estado: "sem-chave" };
  }
  try {
    const res = await fetch("https://safebrowsing.googleapis.com/v4/threatMatches:find?key=" + encodeURIComponent(chave), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "vulnexusai", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url }],
        },
      }),
      signal: AbortSignal.timeout(TIMEOUT_REQUISICAO_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      return { status: "aviso", estado: "falha-consulta" };
    }
    const dados = (await res.json()) as { matches?: unknown[] };
    if (dados.matches && dados.matches.length > 0) {
      return { status: "falha", estado: "ameaca" };
    }
    return { status: "ok", estado: "ok" };
  } catch {
    return { status: "aviso", estado: "sem-conexao" };
  }
}

export async function verificarSite(input: string): Promise<ResultadoCheck> {
  const url = normalizaUrl(input);

  const { respostas, final } = await coletaResponses(url);

  const redirects = respostas.map(r => ({
    status: r.status,
    de: r.url,
    para: r.headers.get("location") || "",
  }));

  if (!tinhaProtocolo(input)) {
    const httpRedirect = await testaRedirectHttp(url);
    if (httpRedirect && !redirects.some(r => r.de.startsWith("http:"))) {
      redirects.unshift(httpRedirect);
    }
  }

  const https = final.url.startsWith("https:");
  const httpParaHttps = https && redirects.some(r => r.de.startsWith("http:") && r.para.startsWith("https:"));

  const cookies: string[] = [];
  for (const res of [final, ...respostas]) {
    const set = res.headers.getSetCookie();
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
    status: https ? "ok" : "falha",
    dados: { hostname },
  });
  itensHttps.push({
    id: "redirect-http",
    status: httpParaHttps ? "ok" : "aviso",
    dados: httpParaHttps
      ? { statusCode: redirects.find(r => r.para.startsWith("https:"))?.status ?? 301 }
      : undefined,
  });
  if (infoTls) {
    itensHttps.push({
      id: "certificado",
      status: infoTls.valido ? "ok" : "falha",
      dados: infoTls.valido
        ? { valido: true, expiraEm: infoTls.expiraEm, dias: infoTls.diasRestantes, emissor: infoTls.emissor }
        : { valido: false, autoAssinado: infoTls.autoAssinado, emissor: infoTls.emissor },
    });
    itensHttps.push({
      id: "tls-versao",
      status: infoTls.tls1_0 || infoTls.tls1_1 ? "falha" : "ok",
      dados: { protocolo: infoTls.protocolo, tls10: infoTls.tls1_0, tls11: infoTls.tls1_1 },
    });
  }
  categorias.push({ id: "https", peso: 20, itens: itensHttps });

  // --- Headers de Segurança (peso 40) ---
  const NOMES_HEADERS: Record<string, string> = {
    hsts: "Strict-Transport-Security",
    csp: "Content-Security-Policy",
    xframe: "X-Frame-Options",
    xcontenttype: "X-Content-Type-Options",
    referrer: "Referrer-Policy",
    permissions: "Permissions-Policy",
  };

  const itensHeaders: ItemCheck[] = [];
  for (const id of Object.keys(NOMES_HEADERS)) {
    const valor = final.headers.get(NOMES_HEADERS[id]);
    const presente = valor !== null && valor.trim() !== "";
    itensHeaders.push({
      id,
      status: presente ? "ok" : "falha",
      dados: presente ? { valor: valor! } : undefined,
    });
  }
  categorias.push({ id: "headers", peso: 30, itens: itensHeaders });

  // --- DNS & Email (peso 20) ---
  const itensDns: ItemCheck[] = [];
  itensDns.push({
    id: "spf",
    status: spf.temSpf ? "ok" : "falha",
    dados: spf.temSpf
      ? { quantidade: spf.registros.filter(r => r.toLowerCase().startsWith("v=spf1")).length }
      : undefined,
  });
  itensDns.push({
    id: "dmarc",
    status: dmarc.temDmarc ? "ok" : "falha",
  });
  itensDns.push({
    id: "dkim",
    status: dkim.sucesso ? "ok" : "aviso",
    dados: dkim.sucesso ? { seletores: dkim.encontrado.join(", ") } : undefined,
  });
  categorias.push({ id: "dns", peso: 15, itens: itensDns });

  // --- Cookies (peso 10) ---
  const itensCookies: ItemCheck[] = [];
  if (cookies.length === 0) {
    itensCookies.push({
      id: "cookies",
      status: "ok",
    });
  } else {
    const seguros = cookies.filter(c => /;\s*secure/i.test(c)).length;
    const httpOnly = cookies.filter(c => /;\s*httponly/i.test(c)).length;
    const total = cookies.length;
    itensCookies.push({
      id: "cookies-secure",
      status: seguros === total ? "ok" : "falha",
      dados: { ok: seguros, total },
    });
    itensCookies.push({
      id: "cookies-httponly",
      status: httpOnly === total ? "ok" : "falha",
      dados: { ok: httpOnly, total },
    });
    itensCookies.push({
      id: "cookies-samesite",
      status: cookies.every(c => /;\s*samesite/i.test(c)) ? "ok" : "aviso",
      dados: { ok: cookies.filter(c => /;\s*samesite/i.test(c)).length, total },
    });
  }
  categorias.push({ id: "cookies", peso: 5, itens: itensCookies });

  // --- Arquivos Sensíveis (peso 15) ---
  const ARQUIVOS_SENSIVEIS: Array<{ id: string; caminho: string }> = [
    { id: "env", caminho: "/.env" },
    { id: "git-config", caminho: "/.git/config" },
    { id: "git-head", caminho: "/.git/HEAD" },
    { id: "wp-backup", caminho: "/wp-config.php.bak" },
    { id: "ds-store", caminho: "/.DS_Store" },
    { id: "config-php", caminho: "/config.php~" },
  ];

  const statusArquivos = await Promise.all(ARQUIVOS_SENSIVEIS.map(a => checaArquivoSensivel(final.url, a.caminho)));

  const itensArquivos: ItemCheck[] = ARQUIVOS_SENSIVEIS.map((a, i) => ({
    id: a.id,
    status: statusArquivos[i]!,
    dados: { caminho: a.caminho },
  }));
  categorias.push({ id: "arquivos", peso: 15, itens: itensArquivos });

  // --- Conteúdo e Metadados (peso 10) ---
  const RECURSOS_PUBLICOS: Array<{ id: string; caminho: string }> = [
    { id: "robots", caminho: "/robots.txt" },
    { id: "sitemap", caminho: "/sitemap.xml" },
    { id: "security-txt", caminho: "/.well-known/security.txt" },
  ];

  const statusRecursos = await Promise.all(RECURSOS_PUBLICOS.map(r => checaRecursoPublico(final.url, r.caminho)));

  const itensRecursos: ItemCheck[] = RECURSOS_PUBLICOS.map((r, i) => {
    const res = statusRecursos[i]!;
    return {
      id: r.id,
      status: res.presente ? "ok" : "aviso",
      dados: { caminho: r.caminho, statusCode: res.status },
    };
  });
  categorias.push({ id: "conteudo", peso: 10, itens: itensRecursos });

  // --- Infraestrutura (peso 5) ---
  const [caa, safeBrowsing] = await Promise.all([checaCaa(base), checaSafeBrowsing(final.url)]);

  const temIssue = caa.registros.some(r => r.tag === "issue");
  const itensInfra: ItemCheck[] = [
    {
      id: "caa",
      status: temIssue ? "ok" : "aviso",
      dados: caa.registros.length > 0
        ? { registros: caa.registros.map(r => `${r.tag}=${r.value}`).join(", ") }
        : undefined,
    },
    {
      id: "safe-browsing",
      status: safeBrowsing.status,
      dados: { estado: safeBrowsing.estado },
    },
  ];
  categorias.push({ id: "infra", peso: 5, itens: itensInfra });

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
