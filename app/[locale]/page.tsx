"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Categoria, ItemCheck, ResultadoCheck, StatusItem } from "@/lib/verificador";
import Topo from "./components/topo";
import Rodape from "./components/rodape";

const CHAVE_HISTORICO = "verificaseguranca:historico";
const MAX_HISTORICO = 8;

type ItemHistorico = {
  url: string;
  score: number;
  grade: string;
  timestamp: string;
};

type Traduz = {
  (key: string, values?: Record<string, string | number | Date>): string;
  has(key: string): boolean;
};

function classeScore(score: number): string {
  if (score >= 85) return "c-excelente";
  if (score >= 70) return "c-bom";
  if (score >= 50) return "c-regular";
  if (score >= 30) return "c-fraco";
  return "c-critico";
}

function classeLargura(frac: number): string {
  const v = Math.max(0, Math.min(100, Math.round(frac / 10) * 10));
  return `w-${v}`;
}

function corScore(score: number): string {
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#22c55e";
  if (score >= 50) return "#d97706";
  if (score >= 30) return "#ea580c";
  return "#dc2626";
}

function nomeScore(score: number): string {
  if (score >= 85) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 50) return "regular";
  if (score >= 30) return "fraco";
  return "critico";
}

function iconeStatus(status: StatusItem): string {
  if (status === "ok") return "✓";
  if (status === "aviso") return "!";
  return "✕";
}

function valoresItem(item: ItemCheck, locale: string): Record<string, string | number | Date> {
  const d = item.dados ?? {};
  const valores: Record<string, string | number | Date> = {};
  if (d.hostname !== undefined) valores.hostname = d.hostname;
  if (d.statusCode !== undefined) valores.statusCode = d.statusCode;
  if (d.expiraEm !== undefined) valores.expiraEm = new Date(d.expiraEm).toLocaleDateString(locale);
  if (d.emissor !== undefined) valores.emissor = d.emissor;
  if (d.protocolo !== undefined) valores.protocolo = d.protocolo;
  if (d.valor !== undefined) valores.valor = d.valor;
  if (d.quantidade !== undefined) valores.quantidade = d.quantidade;
  if (d.seletores !== undefined) valores.seletores = d.seletores;
  if (d.ok !== undefined) valores.ok = d.ok;
  if (d.total !== undefined) valores.total = d.total;
  if (d.caminho !== undefined) valores.caminho = d.caminho;
  if (d.registros !== undefined) valores.registros = d.registros;
  if (d.estado !== undefined) valores.estado = d.estado;
  return valores;
}

function detalheItem(t: Traduz, item: ItemCheck, locale: string): string {
  const base = `checks.${item.id}`;
  const p = valoresItem(item, locale);
  switch (item.id) {
    case "https-ativo":
      return t(`${base}.detalhe.${item.status}`, p);
    case "redirect-http":
      return t(`${base}.detalhe.${item.status}`, p);
    case "certificado":
      if (item.status === "ok") return t(`${base}.detalhe.ok`, p);
      return item.dados?.autoAssinado
        ? t(`${base}.detalhe.autoassinado`, p)
        : t(`${base}.detalhe.invalido`, p);
    case "tls-versao": {
      let s = t(`${base}.detalhe.base`, p);
      if (item.dados?.tls10) s += t(`${base}.detalhe.tls10`);
      if (item.dados?.tls11) s += t(`${base}.detalhe.tls11`);
      return s;
    }
    case "hsts":
    case "csp":
    case "xframe":
    case "xcontenttype":
    case "referrer":
    case "permissions":
      return item.status === "ok" && item.dados?.valor ? item.dados.valor : t(`${base}.detalhe.ausente`);
    case "spf":
      return t(`${base}.detalhe.${item.status === "ok" ? "ok" : "ausente"}`, p);
    case "dmarc":
      return t(`${base}.detalhe.${item.status === "ok" ? "ok" : "ausente"}`);
    case "dkim":
      return t(`${base}.detalhe.${item.status === "ok" ? "ok" : "ausente"}`, p);
    case "cookies":
      return t(`${base}.detalhe.ok`);
    case "cookies-secure":
    case "cookies-httponly":
    case "cookies-samesite":
      return t(`${base}.detalhe.ok`, p);
    case "env":
    case "git-config":
    case "git-head":
    case "wp-backup":
    case "ds-store":
    case "config-php":
      return t(`${base}.detalhe.${item.status}`, p);
    case "robots":
    case "sitemap":
    case "security-txt":
      if (item.status === "ok") return t(`${base}.detalhe.ok`, p);
      return (item.dados?.statusCode ?? 0) > 0
        ? t(`${base}.detalhe.ausente`, p)
        : t(`${base}.detalhe.semResposta`, p);
    case "caa":
      return item.dados?.registros ? item.dados.registros : t(`${base}.detalhe.ausente`);
    case "safe-browsing":
      return t(`${base}.detalhe.${item.dados?.estado ?? item.status}`);
    default:
      return "";
  }
}

function dicaItem(t: Traduz, item: ItemCheck, locale: string): string | undefined {
  const base = `checks.${item.id}`;
  const p = valoresItem(item, locale);
  if (t.has(`${base}.dica`)) return t(`${base}.dica`, p);
  if (t.has(`${base}.dica.${item.status}`)) return t(`${base}.dica.${item.status}`, p);
  return undefined;
}

function textoItem(t: Traduz, locale: string, item: ItemCheck) {
  const base = `checks.${item.id}`;
  const p = valoresItem(item, locale);
  return {
    titulo: t(`${base}.titulo`),
    descricao: t(`${base}.descricao`, p),
    detalhe: detalheItem(t, item, locale),
    dica: dicaItem(t, item, locale),
  };
}

function Radar({ categorias }: { categorias: Categoria[] }) {
  const t = useTranslations();
  const cx = 150;
  const cy = 150;
  const raioMax = 110;
  const n = categorias.length;
  if (n === 0) return null;

  const ponto = (i: number, r: number) => {
    const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r };
  };

  const poligonoGrid = (frac: number) =>
    categorias.map((_, i) => {
      const p = ponto(i, raioMax * frac);
      return `${p.x},${p.y}`;
    }).join(" ");

  const pontosDados = categorias.map((c, i) => {
    const ok = c.itens.filter(x => x.status === "ok").length;
    const total = c.itens.filter(x => x.status !== "aviso").length;
    const frac = total === 0 ? 1 : ok / total;
    const p = ponto(i, raioMax * frac);
    return `${p.x},${p.y}`;
  }).join(" ");

  const labels = categorias.map((c, i) => {
    const p = ponto(i, raioMax + 24);
    return { x: p.x, y: p.y, texto: t(`categorias.${c.id}`) };
  });

  return (
    <svg viewBox="0 0 300 280" role="img" aria-label={t("resultado.radarAria")}>
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={poligonoGrid(f)} fill="none" stroke="#26364f" strokeWidth="1" />
      ))}
      <polygon points={pontosDados} fill="rgba(59,130,246,0.25)" stroke="#3b82f6" strokeWidth="2" />
      {categorias.map((_, i) => {
        const p = ponto(i, raioMax);
        return <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />;
      })}
      {labels.map((l, i) => (
        <text key={i} x={l.x} y={l.y} textAnchor="middle" dominantBaseline="middle" fill="#8fa1c0" fontSize="10">
          {l.texto}
        </text>
      ))}
    </svg>
  );
}

function BarraCategoria({ categoria }: { categoria: Categoria }) {
  const t = useTranslations();
  const locale = useLocale();
  const ok = categoria.itens.filter(x => x.status === "ok").length;
  const total = categoria.itens.filter(x => x.status !== "aviso").length;
  const frac = total === 0 ? 100 : Math.round((ok / total) * 100);

  return (
    <div className="cat">
      <div className="cat-topo">
        <div className="cat-titulo">
          <strong>{t(`categorias.${categoria.id}`)}</strong>
          <span className="cat-peso">{t("resultado.pesoScore", { peso: categoria.peso })}</span>
        </div>
        <div className={`cat-pct ${classeScore(frac)}`}>{frac}%</div>
      </div>
      <div className="barra">
        <div className={`barra-fill ${classeScore(frac)} ${classeLargura(frac)}`} />
      </div>
      <div className="cat-itens">
        {categoria.itens.map(item => {
          const texto = textoItem(t, locale, item);
          return (
            <details key={item.id} className={`item item-${item.status}`}>
              <summary>
                <span className="icone">
                  {iconeStatus(item.status)}
                </span>
                <span className="item-titulo">{texto.titulo}</span>
                <span className="item-status">{t(`resultado.statusItem.${item.status}`)}</span>
              </summary>
              <div className="item-detalhe">
                <p>{texto.descricao}</p>
                <p className="item-valor">{texto.detalhe}</p>
                {texto.dica && (
                  <div className="dica">
                    <strong>{t("resultado.comoCorrigir")}</strong> {texto.dica}
                  </div>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function mensagemErro(t: Traduz, dados: { codigo?: string; retryEmSegundos?: number }): string {
  const codigo = dados?.codigo;
  if (codigo && t.has(`erros.${codigo}`)) {
    const valores: Record<string, string | number | Date> = {};
    if (dados.retryEmSegundos !== undefined) valores.segundos = dados.retryEmSegundos;
    return t(`erros.${codigo}`, valores);
  }
  return t("erros.generico");
}

export default function Home() {
  const t = useTranslations();
  const locale = useLocale();

  const [input, setInput] = useState("");
  const [resultado, setResultado] = useState<ResultadoCheck | null>(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [historico, setHistorico] = useState<ItemHistorico[]>([]);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE_HISTORICO);
      if (raw) setHistorico(JSON.parse(raw) as ItemHistorico[]);
    } catch {
      /* ignore */
    }
  }, []);

  function salvaHistorico(checked: URL, score: number, grade: string) {
    const host = checked.hostname.replace(/^www\./i, "");
    const item: ItemHistorico = {
      url: host,
      score,
      grade,
      timestamp: new Date().toISOString(),
    };
    const novo = [item, ...historico.filter(h => h.url !== host)].slice(0, MAX_HISTORICO);
    setHistorico(novo);
    try {
      localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(novo));
    } catch {
      /* ignore */
    }
  }

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
        setErro(mensagemErro(t, dados));
        return;
      }
      const r = dados as ResultadoCheck;
      setResultado(r);
      salvaHistorico(new URL(r.urlFinal), r.score, r.grade);
    } catch {
      setErro(t("erros.rede"));
    } finally {
      setCarregando(false);
    }
  }

  function verHistorico(h: ItemHistorico) {
    setInput(h.url);
    const el = document.getElementById("input-url");
    el?.focus();
  }

  async function compartilhar() {
    if (!resultado) return;
    const linhas = [
      `VulnexusAI — ${resultado.urlFinal}`,
      t("compartilhar.score", {
        score: resultado.score,
        grade: resultado.grade,
        texto: t(`resultado.score.${nomeScore(resultado.score)}`),
      }),
      "",
      ...resultado.categorias.flatMap(c => {
        const ok = c.itens.filter(i => i.status === "ok").length;
        return [t("compartilhar.categoria", { titulo: t(`categorias.${c.id}`), ok, total: c.itens.length })];
      }),
      "",
      t("compartilhar.chamada"),
    ];
    const texto = linhas.join("\n");
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* ignore */
    }
  }

  async function exportarImagem() {
    if (!resultado) return;
    const canvas = document.createElement("canvas");
    canvas.width = 820;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, 820, 540);
    grad.addColorStop(0, "#0b1220");
    grad.addColorStop(1, "#111a2e");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 820, 540);

    ctx.fillStyle = "#3b82f6";
    ctx.font = "bold 20px Arial";
    ctx.fillText("VULNEXUSAI", 48, 52);

    ctx.fillStyle = "#e6edf7";
    ctx.font = "bold 26px Arial";
    const urlCurta = resultado.urlFinal.length > 46 ? `${resultado.urlFinal.slice(0, 46)}…` : resultado.urlFinal;
    ctx.fillText(urlCurta, 48, 92);

    ctx.textAlign = "right";
    ctx.fillStyle = corScore(resultado.score);
    ctx.font = "bold 64px Arial";
    ctx.fillText(String(resultado.score), 772, 86);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial";
    ctx.fillText(resultado.grade, 772, 120);
    ctx.fillStyle = "#8fa1c0";
    ctx.font = "16px Arial";
    ctx.fillText(t(`resultado.score.${nomeScore(resultado.score)}`), 772, 144);
    ctx.textAlign = "left";

    const inicio = 176;
    const passo = 46;
    const larguraBarra = 560;
    const corBarra = (frac: number) => (frac >= 85 ? "#16a34a" : frac >= 70 ? "#22c55e" : frac >= 50 ? "#d97706" : frac >= 30 ? "#ea580c" : "#dc2626");

    resultado.categorias.forEach((c, i) => {
      const ok = c.itens.filter(x => x.status === "ok").length;
      const total = c.itens.filter(x => x.status !== "aviso").length;
      const frac = total === 0 ? 100 : Math.round((ok / total) * 100);
      const y = inicio + i * passo;

      ctx.fillStyle = "#e6edf7";
      ctx.font = "600 16px Arial";
      ctx.fillText(t(`categorias.${c.id}`), 48, y + 4);

      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(48, y + 12, larguraBarra, 16);

      ctx.fillStyle = corBarra(frac);
      ctx.fillRect(48, y + 12, (larguraBarra * frac) / 100, 16);

      ctx.fillStyle = "#8fa1c0";
      ctx.font = "bold 15px Arial";
      ctx.textAlign = "right";
      ctx.fillText(`${frac}%`, 772, y + 25);
      ctx.textAlign = "left";
    });

    const ultimoY = inicio + resultado.categorias.length * passo;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(48, ultimoY - 6, 724, 1);
    ctx.fillStyle = "#8fa1c0";
    ctx.font = "15px Arial";
    ctx.fillText(t("resultado.imagem.check"), 48, ultimoY + 24);

    const link = document.createElement("a");
    link.download = `vulnexusai-${new URL(resultado.urlFinal).hostname.replace(/^www\./i, "")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <main className="page">
      <Topo mostraHistorico={historico.length > 0} />

      <section className="hero" id="verificar">
        <p className="eyebrow">{t("hero.eyebrow")}</p>
        <h1>
          {t("hero.titulo1")}
          <br />
          <span className="grad">{t("hero.titulo2")}</span>
        </h1>
        <p className="sub">{t("hero.sub")}</p>
        <form
          className="form"
          onSubmit={e => {
            e.preventDefault();
            verificar();
          }}
        >
          <input
            id="input-url"
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t("hero.placeholder")}
            aria-label={t("hero.ariaLabel")}
            disabled={carregando}
          />
          <button type="submit" disabled={carregando}>
            {carregando ? t("hero.verificando") : t("hero.verificar")}
          </button>
        </form>
      </section>

      {erro && (
        <section className="card erro">
          <strong>{t("erros.falhaTitulo")}</strong> {erro}
        </section>
      )}

      {historico.length > 0 && (
        <section className="historico-box" id="historico">
          <h2>{t("historico.titulo")}</h2>
          <ul className="historico">
            {historico.map((h, i) => (
              <li key={i}>
                <button
                  onClick={() => verHistorico(h)}
                  className="hist-chip"
                  title={`${h.url} — ${h.score}`}
                >
                  <span className="hist-url">{h.url}</span>
                  <span className={`hist-score ${classeScore(h.score)}`}>{h.score}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {resultado && (
        <section className="resultado">
          <div className="resumo">
            <div className="resumo-info">
              <div className="url">{resultado.urlFinal}</div>
              <div className="meta">
                {resultado.statusCode && t("resultado.status", { code: resultado.statusCode })}
                {resultado.servidor && ` · ${resultado.servidor}`}
                {" · "}
                {new Date(resultado.timestamp).toLocaleString(locale)}
              </div>
              <div className="acoes">
                <button className="btn" onClick={compartilhar}>
                  {copiado ? t("resultado.copiado") : t("resultado.copiarResumo")}
                </button>
                <button className="btn" onClick={exportarImagem}>
                  {t("resultado.baixarImagem")}
                </button>
              </div>
            </div>
            <div className={`score-wrap ${classeScore(resultado.score)}`}>
              <div className="score">{resultado.score}</div>
              <div className="grade">{resultado.grade}</div>
              <div className="score-label">{t(`resultado.score.${nomeScore(resultado.score)}`)}</div>
            </div>
          </div>

          <div className="dashboard">
            <div className="radar-box">
              <h2>{t("resultado.visaoCategoria")}</h2>
              <Radar categorias={resultado.categorias} />
            </div>
            <div className="cats-box">
              {resultado.categorias.map(c => (
                <BarraCategoria key={c.id} categoria={c} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Rodape />
    </main>
  );
}
