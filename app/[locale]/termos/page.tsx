import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { urlLocale } from "@/lib/rotas";
import Pagina from "../components/pagina";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paginas.termos" });
  const url = urlLocale(locale, "/termos");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url,
      languages: {
        pt: urlLocale("pt", "/termos"),
        en: urlLocale("en", "/termos"),
        es: urlLocale("es", "/termos"),
      },
    },
    openGraph: {
      url,
      title: t("metaTitle"),
      description: t("metaDescription"),
    },
  };
}

export default function TermosPage() {
  return <Pagina slug="termos" />;
}
