import type { MetadataRoute } from "next";
import { artigoCompleto, paresDeSlug, rotasBlog, type LocaleArtigo } from "@/lib/blog";
import { urlLocale } from "@/lib/rotas";

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
        es: "https://vulnexusai.com/es",
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
        es: `https://vulnexusai.com/es/${p}`,
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
        es: "https://vulnexusai.com/es/blog",
      },
    },
  };

  const artigos: MetadataRoute.Sitemap = rotasBlog().map(({ locale, slug }) => {
    const pares = paresDeSlug(locale as LocaleArtigo, slug);
    const data = artigoCompleto(locale as LocaleArtigo, slug).data.data;
    return {
      url: `${urlLocale(locale, "/blog/")}${slug}`,
      lastModified: new Date(`${data}T00:00:00Z`),
      changeFrequency: "monthly",
      priority: 0.7,
      alternates: {
        languages: {
          pt: `https://vulnexusai.com/blog/${pares?.slugPt}`,
          en: `https://vulnexusai.com/en/blog/${pares?.slugEn}`,
          es: `https://vulnexusai.com/es/blog/${pares?.slugEs}`,
        },
      },
    };
  });

  return [home, ...paginas, blogIndex, ...artigos];
}