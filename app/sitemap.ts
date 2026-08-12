import type { MetadataRoute } from "next";

const PAGINAS = ["sobre", "privacidade", "termos", "cookies"] as const;

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

  return [home, ...paginas];
}
