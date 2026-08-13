import type { ResultadoCheck } from "./verificador";
import type { ItensPioraram, Monitor } from "./monitor";

export type AlertaPayload = {
  monitor: Monitor;
  resultado: ResultadoCheck;
  anterior?: ResultadoCheck;
  itensPioraram: ItensPioraram;
};

const LABEL_CATEGORIA: Record<string, string> = {
  https: "HTTPS & Certificado",
  headers: "Headers de Segurança",
  dns: "DNS & Email",
  cookies: "Cookies",
  cors: "CORS",
  arquivos: "Arquivos Sensíveis",
  conteudo: "Conteúdo e Metadados",
  infra: "Infraestrutura",
};

const LABEL_ITEM: Record<string, string> = {
  "https-ativo": "Conexão HTTPS",
  "redirect-http": "Redirect HTTP → HTTPS",
  certificado: "Certificado SSL",
  "tls-versao": "Protocolo TLS",
  hsts: "Header Strict-Transport-Security",
  csp: "Header Content-Security-Policy",
  xframe: "Header X-Frame-Options",
  xcontenttype: "Header X-Content-Type-Options",
  referrer: "Header Referrer-Policy",
  permissions: "Header Permissions-Policy",
  spf: "SPF",
  dmarc: "DMARC",
  dkim: "DKIM",
  "cookies-secure": "Cookies sem Secure",
  "cookies-httponly": "Cookies sem HttpOnly",
  "cookies-samesite": "Cookies sem SameSite",
  env: "Arquivo .env exposto",
  "git-config": "Arquivo .git/config exposto",
  "git-head": "Arquivo .git/HEAD exposto",
  "wp-backup": "Backup wp-config exposto",
  "ds-store": "Arquivo .DS_Store exposto",
  "config-php": "Backup config.php exposto",
  robots: "robots.txt",
  sitemap: "sitemap.xml",
  "security-txt": ".well-known/security.txt",
  caa: "Registro CAA",
  "safe-browsing": "Safe Browsing",
  "cors-indisponivel": "Verificação CORS",
};

export function montaMensagem(payload: AlertaPayload): string {
  const { monitor, resultado, anterior, itensPioraram } = payload;
  const linhas: string[] = [];

  linhas.push(`:warning: Alerta do VulnexusAI Scanner`);
  linhas.push(`**Site:** ${monitor.hostname}`);

  if (anterior) {
    const delta = resultado.score - anterior.score;
    const sinal = delta > 0 ? "+" : "";
    linhas.push(
      `**Score:** ${resultado.score} (${resultado.grade}) — anterior: ${anterior.score} (${anterior.grade}) (${sinal}${delta})`
    );
  } else {
    linhas.push(`**Score:** ${resultado.score} (${resultado.grade})`);
  }

  if (itensPioraram.length > 0) {
    linhas.push(`**Problemas novos:**`);
    for (const item of itensPioraram) {
      const categoria = LABEL_CATEGORIA[item.categoriaId] ?? item.categoriaId;
      const nome = LABEL_ITEM[item.itemId] ?? item.itemId;
      linhas.push(`- [${categoria}] ${nome}`);
    }
  }

  linhas.push(`Verifique em: ${monitor.url}`);
  return linhas.join("\n");
}

export async function enviaAlerta(payload: AlertaPayload): Promise<{ enviado: boolean; erro?: string }> {
  const mensagem = montaMensagem(payload);
  const corpo = payload.monitor.webhookTipo === "slack" ? { text: mensagem } : { content: mensagem };

  try {
    const resposta = await fetch(payload.monitor.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    });
    if (!resposta.ok) {
      console.error(`[webhook] Falha ao enviar alerta (${payload.monitor.webhookTipo}): HTTP ${resposta.status}`);
      return { enviado: false, erro: `HTTP ${resposta.status}` };
    }
    return { enviado: true };
  } catch (erro) {
    console.error(`[webhook] Erro ao enviar alerta (${payload.monitor.webhookTipo}):`, erro);
    return { enviado: false, erro: erro instanceof Error ? erro.message : "erro desconhecido" };
  }
}