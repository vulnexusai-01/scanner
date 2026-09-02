import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { urlLocale } from "@/lib/rotas";
import Comparativo from "../../components/comparativo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "paginas.vsSecurityHeaders" });
  const url = urlLocale(locale, "/vs/securityheaders");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: url,
      languages: {
        pt: urlLocale("pt", "/vs/securityheaders"),
        en: urlLocale("en", "/vs/securityheaders"),
        es: urlLocale("es", "/vs/securityheaders"),
      },
    },
    openGraph: { url, title: t("metaTitle"), description: t("metaDescription") },
  };
}

export default function VsSecurityHeadersPage() {
  return <Comparativo slug="vsSecurityHeaders" urlExterna="https://securityheaders.com" />;
}
