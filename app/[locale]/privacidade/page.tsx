import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { urlLocale } from "@/lib/rotas";
import Pagina from "../components/pagina";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paginas.privacidade" });
  const url = urlLocale(locale, "/privacidade");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url,
      languages: {
        pt: urlLocale("pt", "/privacidade"),
        en: urlLocale("en", "/privacidade"),
        es: urlLocale("es", "/privacidade"),
      },
    },
    openGraph: {
      url,
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  };
}

export default function PrivacidadePage() {
  return <Pagina slug="privacidade" />;
}
