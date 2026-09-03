import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { PARES_DE_ARTIGOS, paresDeSlug, type LocaleArtigo } from "@/lib/pares-idiomas";

export type FrontmatterArtigo = {
  titulo: string;
  descricao: string;
  data: string;
  slug: string;
  faq?: Array<{ pergunta: string; resposta: string }>;
};

export type { LocaleArtigo } from "@/lib/pares-idiomas";

export { PARES_DE_ARTIGOS } from "@/lib/pares-idiomas";

const RELACIONADOS: Record<string, string[]> = {
  "o-que-e-hsts": ["tls-versoes-tls-12-e-tls-13", "content-security-policy-explicada"],
  "content-security-policy-explicada": ["cors-o-que-e-e-como-configurar", "cookies-seguros-secure-httponly-samesite"],
  "spf-dkim-dmarc-guia-completo": ["o-que-e-hsts", "cookies-seguros-secure-httponly-samesite", "por-que-emails-caem-no-spam-spf-dkim-dmarc"],
  "cookies-seguros-secure-httponly-samesite": ["cors-o-que-e-e-como-configurar", "content-security-policy-explicada"],
  "arquivos-sensiveis-expostos": ["robots-txt-e-security-txt", "o-que-e-hsts"],
  "cors-o-que-e-e-como-configurar": ["content-security-policy-explicada", "cookies-seguros-secure-httponly-samesite", "erro-cors-como-resolver-nodejs-nginx"],
  "tls-versoes-tls-12-e-tls-13": ["o-que-e-hsts", "cors-o-que-e-e-como-configurar"],
  "robots-txt-e-security-txt": ["arquivos-sensiveis-expostos", "o-que-e-hsts"],
  "erro-cors-como-resolver-nodejs-nginx": ["cors-o-que-e-e-como-configurar", "content-security-policy-explicada"],
  "por-que-emails-caem-no-spam-spf-dkim-dmarc": ["spf-dkim-dmarc-guia-completo", "o-que-e-hsts"],
};

const BASE = path.join(process.cwd(), "content", "blog");

export function caminhoArtigo(locale: LocaleArtigo, slug: string): string {
  return path.join(BASE, locale, `${slug}.mdx`);
}

export function artigoCompleto(locale: LocaleArtigo, slug: string): { data: FrontmatterArtigo; content: string } {
  try {
    const conteudo = readFileSync(caminhoArtigo(locale, slug), "utf8");
    const { data, content } = matter(conteudo);
    return { data: data as FrontmatterArtigo, content };
  } catch {
    return {
      data: { titulo: slug, descricao: "", data: "1970-01-01", slug },
      content: "",
    };
  }
}

export function listarArtigos(locale: LocaleArtigo): Array<{ slug: string; frontmatter: FrontmatterArtigo }> {
  let dir: string[];
  try {
    dir = readdirSync(path.join(BASE, locale));
  } catch {
    return [];
  }
  const slugs = dir
    .filter(arquivo => arquivo.endsWith(".mdx"))
    .map(arquivo => arquivo.replace(/\.mdx$/, ""));
  return slugs
    .map(slug => {
      const { data } = artigoCompleto(locale, slug);
      return { slug, frontmatter: data };
    })
    .filter(a => a.frontmatter.descricao !== "" && a.frontmatter.titulo !== a.frontmatter.slug)
    .sort((a, b) => (a.frontmatter.data < b.frontmatter.data ? 1 : -1));
}

export { paresDeSlug } from "@/lib/pares-idiomas";

export function artigosRelacionados(
  locale: LocaleArtigo,
  slug: string
): Array<{ slug: string; frontmatter: FrontmatterArtigo }> {
  const par = PARES_DE_ARTIGOS.find(p => p[locale] === slug);
  if (!par) return [];
  const slugsPt = (RELACIONADOS[par.pt] ?? []).filter(s => s !== par.pt).slice(0, 2);
  return slugsPt
    .map(ptSlug => paresDeSlug(locale, ptSlug))
    .filter(
      (p): p is { pt: string; en: string; es: string; slugPt: string; slugEn: string; slugEs: string } => Boolean(p)
    )
    .map(p => {
      const slugAlvo = p[locale];
      return { slug: slugAlvo, frontmatter: artigoCompleto(locale, slugAlvo).data };
    });
}

export function rotasBlog(): Array<{ locale: LocaleArtigo; slug: string }> {
  return PARES_DE_ARTIGOS.flatMap(par => [
    { locale: "pt" as const, slug: par.pt },
    { locale: "en" as const, slug: par.en },
    { locale: "es" as const, slug: par.es },
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
