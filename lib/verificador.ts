import dns from "node:dns/promises";
import net from "node:net";
import tls from "node:tls";

export type ResultadoCheck = {
  url: string;
  urlFinal: string;
  statusCode: number | null;
  https: boolean;
  ssl?: {
    valido: boolean;
    autoAssinado: boolean;
    emitente: string;
    validFrom: string;
    validTo: string;
    diasRestantes: number;
  };
  redirects: { status: number; de: string; para: string }[];
  httpParaHttps: boolean;
  headers: Record<string, { presente: boolean; valor: string }>;
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
};

const HEADERS_CHECK = [
  "Strict-Transport-Security",
  "Content-Security-Policy",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Permissions-Policy",
];

const HEADER_PESO = 100 / HEADERS_CHECK.length;

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

async function coletaRedirects(url: URL, limite = 5): Promise<{ responses: Response[]; final: Response }> {
  let atual = url;
  const responses: Response[] = [];
  let final!: Response;
  for (let i = 0; i <= limite; i++) {
    const res = await fetch(atual, {
      redirect: "manual",
      method: "HEAD",
      headers: { "user-agent": "VerificaSeguranca/1.0 (+scanner de segurança)" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      responses.push(res);
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
  return { responses, final };
}

function checaCertificado(host: string): Promise<ResultadoCheck["ssl"]> {
  return new Promise(resolve => {
    const socket = tls.connect({
      host,
      port: 443,
      servername: host,
      timeout: 10000,
    });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(undefined);
    }, 12000);

    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      clearTimeout(timeout);
      socket.end();
      if (!cert || !cert.subject) {
        resolve(undefined);
        return;
      }
      const valido = cert.valid_to && !socket.authorizationError && new Date(cert.valid_to) > new Date();
      resolve({
        valido: Boolean(valido),
        autoAssinado: socket.authorizationError !== null,
        emitente: String(cert.issuer?.O || cert.issuer?.CN || "desconhecido"),
        validFrom: cert.valid_from || "",
        validTo: cert.valid_to || "",
        diasRestantes: Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86400000),
      });
    });

    socket.once("error", () => {
      clearTimeout(timeout);
      resolve(undefined);
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve(undefined);
    });
  });
}

export async function verificarSite(input: string): Promise<ResultadoCheck> {
  const url = normalizaUrl(input);
  await validaHost(url);

  const { responses, final } = await coletaRedirects(url);

  const redirects = responses.map(r => ({
    status: r.status,
    de: r.url,
    para: r.headers.get("location") || "",
  }));

  const https = final.url.startsWith("https:");
  const httpParaHttps = https && redirects.some(r => r.de.startsWith("http:") && r.para.startsWith("https:"));

  const headers: ResultadoCheck["headers"] = {};
  let scoreHeaders = 0;
  for (const nome of HEADERS_CHECK) {
    const valor = final.headers.get(nome);
    const presente = valor !== null && valor.trim() !== "";
    headers[nome] = { presente, valor: presente ? valor! : "" };
    if (presente) scoreHeaders += HEADER_PESO;
  }

  const ssl = https ? await checaCertificado(new URL(final.url).hostname) : undefined;

  let scoreHttps = 0;
  if (https && ssl?.valido) scoreHttps = 100;
  else if (https && ssl && !ssl.valido && !ssl.autoAssinado) scoreHttps = 50;
  else if (https && ssl?.autoAssinado) scoreHttps = 25;
  else if (https) scoreHttps = 75;
  else scoreHttps = 0;

  const score = Math.round(scoreHeaders * 0.6 + scoreHttps * 0.4);

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
    https,
    ssl,
    redirects,
    httpParaHttps,
    headers,
    score,
    grade,
  };
}
