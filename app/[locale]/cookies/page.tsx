import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Pagina from "../components/pagina";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paginas.cookies" });
  const base = "https://vulnexusai.com";
  const url = locale === "pt" ? "/cookies" : "/en/cookies";
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url,
      languages: {
        pt: `${base}/cookies`,
        en: `${base}/en/cookies`,
      },
    },
    openGraph: {
      url: `${base}${url}`,
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  };
}

export default function CookiesPage() {
  return <Pagina slug="cookies" />;
}
