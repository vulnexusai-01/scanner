import type { MetadataRoute } from "next";
import { artigoCompleto, paresDeSlug, rotasBlog, type LocaleArtigo } from "@/lib/blog";
import { urlLocale } from "@/lib/rotas";

const PAGINAS = ["sobre", "seguranca", "privacidade", "termos", "cookies", "vs/securityheaders", "vs/ssl-labs"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = urlLocale("pt", "/");

  const home: MetadataRoute.Sitemap[number] = {
    url: base,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: 1,
    alternates: {
      languages: {
        pt: urlLocale("pt", "/"),
        en: urlLocale("en", "/"),
        es: urlLocale("es", "/"),
      },
    },
  };

  const paginas: MetadataRoute.Sitemap = PAGINAS.map(p => ({
    url: urlLocale("pt", `/${p}`),
    lastModified: new Date(),
    changeFrequency: "yearly",
    priority: 0.6,
    alternates: {
      languages: {
        pt: urlLocale("pt", `/${p}`),
        en: urlLocale("en", `/${p}`),
        es: urlLocale("es", `/${p}`),
      },
    },
  }));

  const blogIndex: MetadataRoute.Sitemap[number] = {
    url: urlLocale("pt", "/blog"),
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.7,
    alternates: {
      languages: {
        pt: urlLocale("pt", "/blog"),
        en: urlLocale("en", "/blog"),
        es: urlLocale("es", "/blog"),
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
          pt: `${urlLocale("pt", "/blog/")}${pares?.slugPt}`,
          en: `${urlLocale("en", "/blog/")}${pares?.slugEn}`,
          es: `${urlLocale("es", "/blog/")}${pares?.slugEs}`,
        },
      },
    };
  });

  return [home, ...paginas, blogIndex, ...artigos];
}