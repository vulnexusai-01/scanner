import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Pagina from "../components/pagina";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paginas.termos" });
  const base = "https://vulnexusai.com";
  const url = locale === "pt" ? "/termos" : "/en/termos";
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url,
      languages: {
        pt: `${base}/termos`,
        en: `${base}/en/termos`,
      },
    },
    openGraph: {
      url: `${base}${url}`,
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  };
}

export default function TermosPage() {
  return <Pagina slug="termos" />;
}
