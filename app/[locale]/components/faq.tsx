import { getTranslations } from "next-intl/server";

export default async function Faq({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "faq" });
  const perguntas = (t.raw("perguntas") ?? []) as Array<{ q: string; a: string }>;

  return (
    <section className="faq" id="faq">
      <h2>{t("titulo")}</h2>
      <div className="faq-lista">
        {perguntas.map((p, i) => (
          <details key={i} className="item">
            <summary>
              <span className="item-titulo">{p.q}</span>
            </summary>
            <div className="item-detalhe">
              <p>{p.a}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}