import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Inter, JetBrains_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import { localeOg, prefixoLocale, urlLocale } from "@/lib/rotas";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--sans", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--mono", display: "swap" });

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

type Props = {
  params: Promise<{ locale: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const base = "https://vulnexusai.com";
  const pt = locale === "pt";
  return {
    metadataBase: new URL(base),
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "pt" ? "/" : prefixoLocale(locale),
      languages: {
        pt: base,
        en: `${base}/en`,
        es: `${base}/es`,
      },
    },
    robots: {
      index: true,
      follow: true,
    },
    verification: {
      google: "IyuFkxbDXUYi-0X5WUCgYzAJV9U3otdIOUbCb5OVHHY",
    },
    openGraph: {
      type: "website",
      url: urlLocale(locale, "/"),
      siteName: "VulnexusAI",
      locale: localeOg(locale),
      alternateLocale: pt ? ["en_US", "es_ES"] : locale === "en" ? ["pt_BR", "es_ES"] : ["pt_BR", "en_US"],
      title: t("ogTitle"),
      description: t("ogDescription"),
    },
    twitter: {
      card: "summary_large_image",
      title: t("twitterTitle"),
      description: t("twitterDescription"),
    },
  };
}

export default async function RootLayout({ params, children }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
