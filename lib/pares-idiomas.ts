export type LocaleArtigo = "pt" | "en" | "es";

/**
 * Fonte da verdade dos slugs pareados entre idiomas. Módulo puro (sem imports
 * de node:fs) para poder ser usado em componentes client ("use client"), como
 * o seletor de idioma do topo — o slug de um artigo muda conforme o idioma.
 */
export const PARES_DE_ARTIGOS: ReadonlyArray<{ pt: string; en: string; es: string }> = [
  { pt: "o-que-e-hsts", en: "what-is-hsts", es: "que-es-hsts" },
  { pt: "content-security-policy-explicada", en: "content-security-policy-explained", es: "content-security-policy-explicada" },
  { pt: "spf-dkim-dmarc-guia-completo", en: "spf-dkim-dmarc-complete-guide", es: "spf-dkim-dmarc-guia-completo" },
  { pt: "cookies-seguros-secure-httponly-samesite", en: "secure-cookies-secure-httponly-samesite", es: "cookies-seguras-secure-httponly-samesite" },
  { pt: "arquivos-sensiveis-expostos", en: "sensitive-files-exposed", es: "archivos-sensibles-expuestos" },
  { pt: "cors-o-que-e-e-como-configurar", en: "cors-what-it-is-and-how-to-configure", es: "cors-que-es-y-como-configurar" },
  { pt: "tls-versoes-tls-12-e-tls-13", en: "tls-versions-tls-12-and-tls-13", es: "tls-versiones-tls-12-y-tls-13" },
  { pt: "robots-txt-e-security-txt", en: "robots-txt-and-security-txt", es: "robots-txt-y-security-txt" },
  { pt: "erro-cors-como-resolver-nodejs-nginx", en: "fixing-cors-errors-nodejs-nginx", es: "error-de-cors-como-resolverlo-en-nodejs-y-nginx" },
  { pt: "por-que-emails-caem-no-spam-spf-dkim-dmarc", en: "why-emails-go-to-spam-spf-dkim-dmarc", es: "por-que-tus-emails-caen-en-spam-spf-dkim-dmarc" },
];

export type ParesDeSlug = { pt: string; en: string; es: string; slugPt: string; slugEn: string; slugEs: string };

/** Retorna os slugs irmãos do artigo cujo slug no locale é `slug`. */
export function paresDeSlug(locale: LocaleArtigo, slug: string): ParesDeSlug | undefined {
  const par = PARES_DE_ARTIGOS.find(p => p[locale] === slug);
  if (!par) return undefined;
  return { pt: par.pt, en: par.en, es: par.es, slugPt: par.pt, slugEn: par.en, slugEs: par.es };
}