import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";

export type FrontmatterArtigo = {
  titulo: string;
  descricao: string;
  data: string;
  slug: string;
};

export type LocaleArtigo = "pt" | "en";

export const PARES_DE_ARTIGOS: ReadonlyArray<{ pt: string; en: string }> = [
  { pt: "o-que-e-hsts", en: "what-is-hsts" },
  { pt: "content-security-policy-explicada", en: "content-security-policy-explained" },
  { pt: "spf-dkim-dmarc-guia-completo", en: "spf-dkim-dmarc-complete-guide" },
  { pt: "cookies-seguros-secure-httponly-samesite", en: "secure-cookies-secure-httponly-samesite" },
  { pt: "arquivos-sensiveis-expostos", en: "sensitive-files-exposed" },
];

const BASE = path.join(process.cwd(), "content", "blog");

export function caminhoArtigo(locale: LocaleArtigo, slug: string): string {
  return path.join(BASE, locale, `${slug}.mdx`);
}

export function artigoCompleto(locale: LocaleArtigo, slug: string): { data: FrontmatterArtigo; content: string } {
  const conteudo = readFileSync(caminhoArtigo(locale, slug), "utf8");
  const { data, content } = matter(conteudo);
  return { data: data as FrontmatterArtigo, content };
}

export function listarArtigos(locale: LocaleArtigo): Array<{ slug: string; frontmatter: FrontmatterArtigo }> {
  const dir = path.join(BASE, locale);
  const slugs = readdirSync(dir)
    .filter(arquivo => arquivo.endsWith(".mdx"))
    .map(arquivo => arquivo.replace(/\.mdx$/, ""));
  return slugs
    .map(slug => ({ slug, frontmatter: artigoCompleto(locale, slug).data }))
    .sort((a, b) => (a.frontmatter.data < b.frontmatter.data ? 1 : -1));
}

export function paresDeSlug(locale: LocaleArtigo, slug: string): { slugPt: string; slugEn: string } | undefined {
  const par = PARES_DE_ARTIGOS.find(p => p[locale] === slug);
  if (!par) return undefined;
  return { slugPt: par.pt, slugEn: par.en };
}

export function rotasBlog(): Array<{ locale: LocaleArtigo; slug: string }> {
  return PARES_DE_ARTIGOS.flatMap(par => [
    { locale: "pt" as const, slug: par.pt },
    { locale: "en" as const, slug: par.en },
  ]);
}

export function existeArtigo(locale: LocaleArtigo, slug: string): boolean {
  try {
    readFileSync(caminhoArtigo(locale, slug), "utf8");
    return true;
  } catch {
    return false;
  }
}
