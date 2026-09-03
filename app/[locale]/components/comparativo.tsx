"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import Topo from "./topo";
import Rodape from "./rodape";

type LinhaTabela = { criterio: string; nos: string; eles: string };

export default function Comparativo({ slug, urlExterna }: { slug: string; urlExterna: string }) {
  const t = useTranslations(`paginas.${slug}`);
  const linhas = t.raw("tabela") as LinhaTabela[];

  return (
    <main className="page">
      <Topo />
      <article className="comparativo">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("titulo")}</h1>
        <p className="pagina-resumo">{t("resumo")}</p>

        <div className="tabela-comparativo-wrap">
          <table className="tabela-comparativo">
            <thead>
              <tr>
                <th>{t("colunaCriterio")}</th>
                <th>VulnexusAI</th>
                <th>{t("colunaConcorrente")}</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(linha => (
                <tr key={linha.criterio}>
                  <td>{linha.criterio}</td>
                  <td className="tabela-comparativo-nos">{linha.nos}</td>
                  <td>{linha.eles}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagina-secoes">
          <section>
            <h2>{t("veredictoTitulo")}</h2>
            <p>{t("veredictoTexto")}</p>
          </section>
        </div>

        <div className="cta-verificar">
          <strong>{t("ctaTitulo")}</strong>
          <p>{t("ctaTexto")}</p>
          <Link href="/">{t("ctaBotao")}</Link>
        </div>

        <p className="foot-note" style={{ marginTop: 20 }}>
          {t("linkExterno")}{" "}
          <a href={urlExterna} target="_blank" rel="noopener noreferrer nofollow">
            {t("linkExternoTexto")}
          </a>
        </p>
      </article>
      <Rodape />
    </main>
  );
}
