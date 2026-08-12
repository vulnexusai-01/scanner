"use client";

import { useTranslations } from "next-intl";
import Topo from "./topo";
import Rodape from "./rodape";

type Secao = { h: string; p: string };

export default function Pagina({ slug }: { slug: string }) {
  const t = useTranslations(`paginas.${slug}`);
  const secoes = (t.raw("secoes") as Secao[] | undefined) ?? [];

  return (
    <main className="page">
      <Topo />
      <article className="pagina">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("titulo")}</h1>
        <p className="pagina-resumo">{t("resumo")}</p>
        <div className="pagina-secoes">
          {secoes.map(secao => (
            <section key={secao.h}>
              <h2>{secao.h}</h2>
              <p>{secao.p}</p>
            </section>
          ))}
        </div>
      </article>
      <Rodape />
    </main>
  );
}
