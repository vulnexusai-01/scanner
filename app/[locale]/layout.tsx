import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { Inter, JetBrains_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
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
  const url = locale === "pt" ? base : `${base}/en`;
  const pt = locale === "pt";
  return {
    metadataBase: new URL(base),
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "pt" ? "/" : "/en",
      languages: {
        pt: base,
        en: `${base}/en`,
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
      url,
      siteName: "VulnexusAI",
      locale: pt ? "pt_BR" : "en_US",
      alternateLocale: pt ? ["en_US"] : ["pt_BR"],
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

  const c = await cookies();
  const h = await headers();
  const nonce = c.get("vx_nonce")?.value ?? h.get("x-nonce") ?? undefined;

  const messages = await getMessages();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "VulnexusAI",
    url: "https://vulnexusai.com",
    description: (messages.meta?.jsonLdDescription as string | undefined) ?? "",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Any",
    inLanguage: locale,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "BRL",
    },
  };

  return (
    <html lang={locale}>
      <body className={`${inter.variable} ${jetbrainsMono.variable}`}>
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
