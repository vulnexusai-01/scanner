import type { MetadataRoute } from "next";
import { artigoCompleto, paresDeSlug, rotasBlog, type LocaleArtigo } from "@/lib/blog";

const PAGINAS = ["sobre", "seguranca", "privacidade", "termos", "cookies"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const home: MetadataRoute.Sitemap[number] = {
    url: "https://vulnexusai.com",
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 1,
    alternates: {
      languages: {
        pt: "https://vulnexusai.com",
        en: "https://vulnexusai.com/en",
      },
    },
  };

  const paginas: MetadataRoute.Sitemap = PAGINAS.map(p => ({
    url: `https://vulnexusai.com/${p}`,
    lastModified: new Date(),
    changeFrequency: "yearly",
    priority: 0.6,
    alternates: {
      languages: {
        pt: `https://vulnexusai.com/${p}`,
        en: `https://vulnexusai.com/en/${p}`,
      },
    },
  }));

  const blogIndex: MetadataRoute.Sitemap[number] = {
    url: "https://vulnexusai.com/blog",
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.7,
    alternates: {
      languages: {
        pt: "https://vulnexusai.com/blog",
        en: "https://vulnexusai.com/en/blog",
      },
    },
  };

  const artigos: MetadataRoute.Sitemap = rotasBlog().map(({ locale, slug }) => {
    const pares = paresDeSlug(locale as LocaleArtigo, slug);
    const data = artigoCompleto(locale as LocaleArtigo, slug).data.data;
    return {
      url: `https://vulnexusai.com${locale === "pt" ? "" : "/en"}/blog/${slug}`,
      lastModified: new Date(`${data}T00:00:00Z`),
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: {
        languages: {
          pt: `https://vulnexusai.com/blog/${pares?.slugPt}`,
          en: `https://vulnexusai.com/en/blog/${pares?.slugEn}`,
        },
      },
    };
  });

  return [home, ...paginas, blogIndex, ...artigos];
}
