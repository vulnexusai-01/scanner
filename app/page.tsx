"use client";

import { useState } from "react";
import type { ResultadoCheck } from "@/lib/verificador";

const DESCRICOES: Record<string, string> = {
  "Strict-Transport-Security": "HSTS — força conexões HTTPS e impede downgrade.",
  "Content-Security-Policy": "CSP — controla quais recursos o navegador pode carregar.",
  "X-Frame-Options": "Impede que o site seja exibido dentro de iframes de terceiros (clickjacking).",
  "X-Content-Type-Options": "Impede MIME sniffing do navegador.",
  "Referrer-Policy": "Controla quais informações são enviadas no header Referer.",
  "Permissions-Policy": "Limita acesso a APIs do navegador (câmera, GPS, etc.).",
};

function nota(score: number): { cor: string; texto: string } {
  if (score >= 85) return { cor: "#16a34a", texto: "Excelente" };
  if (score >= 70) return { cor: "#d97706", texto: "Bom" };
  if (score >= 50) return { cor: "#ea580c", texto: "Regular" };
  return { cor: "#dc2626", texto: "Crítico" };
}

export default function Home() {
  const [input, setInput] = useState("");
  const [resultado, setResultado] = useState<ResultadoCheck | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function verificar() {
    setErro("");
    setResultado(null);
    setCarregando(true);
    try {
      const res = await fetch("/api/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input }),
      });
      const dados = await res.json();
      if (!res.ok) {
        setErro(dados.erro || "Falha ao verificar.");
        return;
      }
      setResultado(dados as ResultadoCheck);
    } catch {
      setErro("Falha de rede ao entrar em contato com o servidor.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <h1>VerificaSeguranca</h1>
        <p className="sub">
          Verifique headers de segurança, HTTPS e certificado SSL de qualquer site.
        </p>
        <form
          className="form"
          onSubmit={e => {
            e.preventDefault();
            verificar();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="ex.: mareagora.com.br"
            aria-label="URL do site a verificar"
            disabled={carregando}
          />
          <button type="submit" disabled={carregando}>
            {carregando ? "Verificando..." : "Verificar"}
          </button>
        </form>
      </section>

      {erro && (
        <section className="card erro">
          <strong>Não foi possível verificar:</strong> {erro}
        </section>
      )}

      {resultado && (
        <section className="resultado">
          <div className="topo">
            <div>
              <div className="url">{resultado.urlFinal}</div>
              <div className="meta">
                {resultado.statusCode && `Status ${resultado.statusCode}`}
                {" · "}
                {resultado.https ? "HTTPS ativo" : "Sem HTTPS"}
                {resultado.redirects.length > 0 &&
                  ` · ${resultado.redirects.length} redirect(s)`}
              </div>
            </div>
            <div className="score-wrap">
              <div className="score" style={{ color: nota(resultado.score).cor }}>
                {resultado.score}
              </div>
              <div className="grade">{resultado.grade}</div>
              <div className="score-label" style={{ color: nota(resultado.score).cor }}>
                {nota(resultado.score).texto}
              </div>
            </div>
          </div>

          <div className="sec">
            <h2>HTTPS e SSL</h2>
            <ul className="lista">
              <li className={resultado.https ? "ok" : "falha"}>
                <span className="check">{resultado.https ? "✓" : "✕"}</span>
                <div>
                  <strong>Conexão HTTPS</strong>
                  <span>{resultado.https ? "O site responde via HTTPS." : "O site não oferece HTTPS."}</span>
                </div>
              </li>
              <li className={resultado.httpParaHttps ? "ok" : "aviso"}>
                <span className="check">{resultado.httpParaHttps ? "✓" : "!"}</span>
                <div>
                  <strong>Redirect HTTP → HTTPS</strong>
                  <span>
                    {resultado.httpParaHttps
                      ? "Visitas via HTTP são redirecionadas para HTTPS."
                      : "Não foi detectado redirecionamento automático de HTTP para HTTPS."}
                  </span>
                </div>
              </li>
              {resultado.ssl && (
                <li className={resultado.ssl.valido ? "ok" : "falha"}>
                  <span className="check">{resultado.ssl.valido ? "✓" : "✕"}</span>
                  <div>
                    <strong>
                      Certificado SSL {resultado.ssl.autoAssinado ? "(auto-assinado)" : ""}
                    </strong>
                    <span>
                      {resultado.ssl.valido
                        ? `Válido até ${new Date(resultado.ssl.validTo).toLocaleDateString("pt-BR")} (${resultado.ssl.diasRestantes} dias). Emitido por ${resultado.ssl.emitente}.`
                        : `Inválido ou expirado. Emitente: ${resultado.ssl.emitente}.`}
                    </span>
                  </div>
                </li>
              )}
            </ul>
          </div>

          <div className="sec">
            <h2>Headers de segurança</h2>
            <ul className="lista">
              {Object.entries(resultado.headers).map(([nome, h]) => (
                <li key={nome} className={h.presente ? "ok" : "falha"}>
                  <span className="check">{h.presente ? "✓" : "✕"}</span>
                  <div>
                    <strong>{nome}</strong>
                    <span>{DESCRICOES[nome]}</span>
                    {h.presente && <code>{h.valor}</code>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <footer className="footer">
        Ferramenta educativa — não substitui uma auditoria de segurança profissional.
      </footer>
    </main>
  );
}
