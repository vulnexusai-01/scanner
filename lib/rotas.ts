import type { LocaleArtigo } from "@/lib/blog";

export const IDIOMAS: readonly LocaleArtigo[] = ["pt", "en", "es"] as const;

const BASE = "https://vulnexusai.com";

/** Prefixo de localidade em URL (ex.: "" para pt, "/en" e "/es"). */
export function prefixoLocale(locale: string): string {
  return locale === "pt" ? "" : `/${locale}`;
}

/** URL absoluta de uma rota, adaptada à localidade. Ex.: caminhoLocale("en", "/blog"). */
export function urlLocale(locale: string, caminho: string): string {
  return `${BASE}${prefixoLocale(locale)}${caminho}`;
}

/** Native OpenGraph locale separador. */
export function localeOg(locale: string): string {
  switch (locale) {
    case "pt":
      return "pt_BR";
    case "en":
      return "en_US";
    default:
      return "es_ES";
  }
}