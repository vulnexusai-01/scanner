import { cookies, headers } from "next/headers";
import { getMessages } from "next-intl/server";
import Scanner from "./scanner";
import Faq from "./components/faq";
import Rodape from "./components/rodape";

type Props = { params: Promise<{ locale: string }> };

export default async function Home({ params }: Props) {
  const { locale } = await params;
  const messages = await getMessages({ locale });
  const faqItems = (messages.faq?.perguntas ?? []) as Array<{ q: string; a: string }>;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        mainEntity: faqItems.map(item => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
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
      },
    ],
  };

  const c = await cookies();
  const h = await headers();
  const nonce = c.get("vx_nonce")?.value ?? h.get("x-nonce") ?? undefined;

  return (
    <main className="page">
      <Scanner />
      <Faq locale={locale} />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Rodape />
    </main>
  );
}