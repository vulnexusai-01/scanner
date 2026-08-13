import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listarArtigos, type LocaleArtigo } from "@/lib/blog";
import Topo from "../components/topo";
import Rodape from "../components/rodape";
import AdSlot from "./components/ad-slot";

type Props = { params: Promise<{ locale: string }> };

const BASE = "https://vulnexusai.com";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const url = locale === "pt" ? "/blog" : "/en/blog";
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url,
      languages: {
        pt: `${BASE}/blog`,
        en: `${BASE}/en/blog`,
      },
    },
    openGraph: {
      url: `${BASE}${url}`,
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  };
}

export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "blog" });
  const artigos = listarArtigos(locale as LocaleArtigo);

  return (
    <main className="page">
      <Topo />
      <header className="blog-cabecalho">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{t("titulo")}</h1>
        <p className="blog-sub">{t("sub")}</p>
      </header>

      <section className="blog-lista">
        {artigos.map(artigo => {
          const data = new Date(`${artigo.frontmatter.data}T00:00:00Z`);
          return (
            <Link key={artigo.slug} href={`/blog/${artigo.slug}`} className="blog-card">
              <h2>{artigo.frontmatter.titulo}</h2>
              <p>{artigo.frontmatter.descricao}</p>
              <time dateTime={artigo.frontmatter.data} className="blog-data">
                {t("dataPublicacao", {
                  data: data.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" }),
                })}
              </time>
              <span className="blog-ler">{t("lerArtigo")}</span>
            </Link>
          );
        })}
      </section>

      <AdSlot slot="blog-rodape" />
      <Rodape />
    </main>
  );
}
