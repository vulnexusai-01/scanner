"use client";

import { useEffect, useState } from "react";
import type { Categoria, ResultadoCheck, StatusItem } from "@/lib/verificador";

const CHAVE_HISTORICO = "verificaseguranca:historico";
const MAX_HISTORICO = 8;

type ItemHistorico = {
  url: string;
  score: number;
  grade: string;
  timestamp: string;
};

function corStatus(status: StatusItem): string {
  if (status === "ok") return "#16a34a";
  if (status === "aviso") return "#d97706";
  return "#dc2626";
}

function corScore(score: number): string {
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#22c55e";
  if (score >= 50) return "#d97706";
  if (score >= 30) return "#ea580c";
  return "#dc2626";
}

function textoScore(score: number): string {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bom";
  if (score >= 50) return "Regular";
  if (score >= 30) return "Fraco";
  return "Crítico";
}

function iconeStatus(status: StatusItem): string {
  if (status === "ok") return "✓";
  if (status === "aviso") return "!";
  return "✕";
}

function Radar({ categorias }: { categorias: Categoria[] }) {
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
    return { x: p.x, y: p.y, texto: c.titulo };
  });

  return (
    <svg viewBox="0 0 300 280" role="img" aria-label="Gráfico radar por categoria">
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
  const ok = categoria.itens.filter(x => x.status === "ok").length;
  const total = categoria.itens.filter(x => x.status !== "aviso").length;
  const frac = total === 0 ? 100 : Math.round((ok / total) * 100);

  return (
    <div className="cat">
      <div className="cat-topo">
        <div className="cat-titulo">
          <strong>{categoria.titulo}</strong>
          <span className="cat-peso">{categoria.peso}% do score</span>
        </div>
        <div className="cat-pct" style={{ color: corScore(frac) }}>{frac}%</div>
      </div>
      <div className="barra">
        <div className="barra-fill" style={{ width: `${frac}%`, background: corScore(frac) }} />
      </div>
      <div className="cat-itens">
        {categoria.itens.map(item => (
          <details key={item.id} className={`item item-${item.status}`}>
            <summary>
              <span className="icone" style={{ background: corStatus(item.status) }}>
                {iconeStatus(item.status)}
              </span>
              <span className="item-titulo">{item.titulo}</span>
              <span className="item-status">{item.status === "ok" ? "ok" : item.status === "aviso" ? "atenção" : "falta"}</span>
            </summary>
            <div className="item-detalhe">
              <p>{item.descricao}</p>
              <p className="item-valor">{item.detalhe}</p>
              {item.dica && (
                <div className="dica">
                  <strong>Como corrigir:</strong> {item.dica}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
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

  function salvaHistorico(checked: URL) {
    const host = checked.hostname.replace(/^www\./i, "");
    const item: ItemHistorico = {
      url: host,
      score: resultado?.score ?? 0,
      grade: resultado?.grade ?? "-",
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
        setErro(dados.erro || "Falha ao verificar.");
        return;
      }
      const r = dados as ResultadoCheck;
      setResultado(r);
      salvaHistorico(new URL(r.urlFinal));
    } catch {
      setErro("Falha de rede ao entrar em contato com o servidor.");
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
      `VerificaSeguranca — ${resultado.urlFinal}`,
      `Score: ${resultado.score}/100 (${resultado.grade}) — ${textoScore(resultado.score)}`,
      "",
      ...resultado.categorias.flatMap(c => {
        const ok = c.itens.filter(i => i.status === "ok").length;
        return [`${c.titulo}: ${ok}/${c.itens.length}`];
      }),
      "",
      "Verifique seu site em vulnexusai.com",
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

  return (
    <main className="page">
      <header className="topo">
        <a href="/" className="logo">
          <span className="logo-badge">VS</span>
          <span className="logo-txt">Verifica<span>Seguranca</span></span>
        </a>
        <nav>
          <a href="#verificar" className="nav-link">Verificar</a>
          {historico.length > 0 && <a href="#historico" className="nav-link">Histórico</a>}
        </nav>
      </header>

      <section className="hero" id="verificar">
        <h1>Verificação básica de segurança</h1>
        <p className="sub">
          Headers, HTTPS, certificado SSL, DNS de email e cookies — com score automático e dicas de correção.
        </p>
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
            placeholder="ex.: exemplo.com.br"
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
          <div className="resumo">
            <div className="resumo-info">
              <div className="url">{resultado.urlFinal}</div>
              <div className="meta">
                {resultado.statusCode && `Status ${resultado.statusCode}`}
                {resultado.servidor && ` · ${resultado.servidor}`}
                {" · "}
                {new Date(resultado.timestamp).toLocaleString("pt-BR")}
              </div>
              <div className="acoes">
                <button className="btn" onClick={compartilhar}>
                  {copiado ? "Copiado!" : "Copiar resumo"}
                </button>
              </div>
            </div>
            <div className="score-wrap" style={{ ["--score-color" as string]: corScore(resultado.score) }}>
              <div className="score">{resultado.score}</div>
              <div className="grade">{resultado.grade}</div>
              <div className="score-label">{textoScore(resultado.score)}</div>
            </div>
          </div>

          <div className="dashboard">
            <div className="radar-box">
              <h2>Visão por categoria</h2>
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

      {historico.length > 0 && (
        <section className="card" id="historico">
          <h2>Histórico recente</h2>
          <ul className="historico">
            {historico.map((h, i) => (
              <li key={i}>
                <button onClick={() => verHistorico(h)} className="hist-btn">
                  <span className="hist-url">{h.url}</span>
                  <span className="hist-data">
                    {new Date(h.timestamp).toLocaleDateString("pt-BR")} {new Date(h.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </button>
                <span className="hist-score" style={{ color: corScore(h.score) }}>{h.score}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="footer">
        Ferramenta educativa — não substitui uma auditoria de segurança profissional.
      </footer>
    </main>
  );
}
