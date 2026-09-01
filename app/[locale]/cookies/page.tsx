import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { urlLocale } from "@/lib/rotas";
import Pagina from "../components/pagina";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paginas.cookies" });
  const url = urlLocale(locale, "/cookies");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url,
      languages: {
        pt: urlLocale("pt", "/cookies"),
        en: urlLocale("en", "/cookies"),
        es: urlLocale("es", "/cookies"),
      },
    },
    openGraph: {
      url,
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  };
}

export default function CookiesPage() {
  return <Pagina slug="cookies" />;
}
