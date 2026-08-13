import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { compileMDX } from "next-mdx-remote/rsc";
import { Link } from "@/i18n/navigation";
import {
  artigoCompleto,
  existeArtigo,
  paresDeSlug,
  rotasBlog,
  type FrontmatterArtigo,
  type LocaleArtigo,
} from "@/lib/blog";
import Topo from "../../components/topo";
import Rodape from "../../components/rodape";
import VerificarCta from "../components/verificar-cta";
import AdSlot from "../components/ad-slot";

type Props = { params: Promise<{ locale: string; slug: string }> };

const BASE = "https://vulnexusai.com";

export function generateStaticParams() {
  return rotasBlog().map(r => ({ locale: r.locale, slug: r.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!existeArtigo(locale as LocaleArtigo, slug)) return {};
  const { data } = artigoCompleto(locale as LocaleArtigo, slug);
  const pares = paresDeSlug(locale as LocaleArtigo, slug);
  if (!pares) return {};
  const url = locale === "pt" ? `/blog/${slug}` : `/en/blog/${slug}`;
  return {
    title: `${data.titulo} | VulnexusAI`,
    description: data.descricao,
    alternates: {
      canonical: url,
      languages: {
        pt: `${BASE}/blog/${pares.slugPt}`,
        en: `${BASE}/en/blog/${pares.slugEn}`,
      },
    },
    openGraph: {
      type: "article",
      url: `${BASE}${url}`,
      title: data.titulo,
      description: data.descricao,
      publishedTime: new Date(`${data.data}T00:00:00Z`).toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: data.titulo,
      description: data.descricao,
    },
  };
}

export default async function ArtigoPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!existeArtigo(locale as LocaleArtigo, slug)) notFound();
  const l = locale as LocaleArtigo;

  const { data, content } = artigoCompleto(l, slug);
  const { content: corpo } = await compileMDX<FrontmatterArtigo>({
    source: content,
  });

  const c = await cookies();
  const h = await headers();
  const nonce = c.get("vx_nonce")?.value ?? h.get("x-nonce") ?? undefined;

  const t = await getTranslations({ locale, namespace: "blog" });
  const tRoot = await getTranslations({ locale });
  const pares = paresDeSlug(l, slug);
  const urlLocal = locale === "pt" ? `/blog/${slug}` : `/en/blog/${slug}`;
  const idiomaAlternativo = locale === "pt" ? "en" : "pt";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: data.titulo,
    description: data.descricao,
    datePublished: new Date(`${data.data}T00:00:00Z`).toISOString(),
    inLanguage: locale,
    author: { "@type": "Organization", name: "VulnexusAI", url: BASE },
    publisher: { "@type": "Organization", name: "VulnexusAI", url: BASE },
    mainEntityOfPage: `${BASE}${urlLocal}`,
  };

  return (
    <main className="page">
      <Topo />
      <article className="artigo">
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1>{data.titulo}</h1>
        <p className="artigo-resumo">{data.descricao}</p>
        <p className="artigo-meta">
          {t("dataPublicacao", {
            data: new Date(`${data.data}T00:00:00Z`).toLocaleDateString(locale, {
              day: "2-digit",
              month: "long",
              year: "numeric",
            }),
          })}
        </p>
        <div className="artigo-corpo">{corpo}</div>
        {pares && (
          <p className="artigo-outro-idioma">
            <Link href={`/blog/${idiomaAlternativo === "pt" ? pares.slugPt : pares.slugEn}`}>
              {t("lerEmOutroIdioma", { idioma: tRoot(`langSwitcher.${idiomaAlternativo}`) })}
            </Link>
          </p>
        )}
        <VerificarCta locale={l} />
        <AdSlot slot="artigo-rodape" />
      </article>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Rodape />
    </main>
  );
}
