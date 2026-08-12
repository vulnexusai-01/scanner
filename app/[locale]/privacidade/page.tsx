import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Pagina from "../components/pagina";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paginas.privacidade" });
  const base = "https://vulnexusai.com";
  const url = locale === "pt" ? "/privacidade" : "/en/privacidade";
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url,
      languages: {
        pt: `${base}/privacidade`,
        en: `${base}/en/privacidade`,
      },
    },
    openGraph: {
      url: `${base}${url}`,
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  };
}

export default function PrivacidadePage() {
  return <Pagina slug="privacidade" />;
}
