import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { urlLocale } from "@/lib/rotas";
import Comparativo from "../../components/comparativo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paginas.vsSslLabs" });
  const url = urlLocale(locale, "/vs/ssl-labs");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url,
      languages: {
        pt: urlLocale("pt", "/vs/ssl-labs"),
        en: urlLocale("en", "/vs/ssl-labs"),
        es: urlLocale("es", "/vs/ssl-labs"),
      },
    },
    openGraph: { url, title: t("metaTitle"), description: t("metaDescription") },
  };
}

export default function VsSslLabsPage() {
  return <Comparativo slug="vsSslLabs" urlExterna="https://www.ssllabs.com/ssltest/" />;
}
