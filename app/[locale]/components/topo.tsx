"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

const IDIOMAS_TOPO = ["pt", "en", "es"] as const;

export default function Topo({ mostraHistorico = false }: { mostraHistorico?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const naHome = pathname === "/";
  const noBlog = pathname.startsWith("/blog");
  const verificarHref = naHome ? "#verificar" : "/#verificar";
  const historicoHref = naHome ? "#historico" : "/#historico";

  return (
    <header className="topo">
      <Link href="/" className="logo">
        <span className="logo-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 5L12 17L20 5"
              stroke="var(--cyan)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="19.5" r="1.4" fill="var(--cyan)" />
          </svg>
        </span>
        <span className="logo-txt">
          Vulnexus<span>AI</span>
        </span>
      </Link>
      <nav>
        <Link href={verificarHref} className={`nav-link${naHome ? " active" : ""}`}>
          {t("nav.verificar")}
        </Link>
        {mostraHistorico && (
          <Link href={historicoHref} className="nav-link">
            {t("nav.historico")}
          </Link>
        )}
        <Link href="/blog" className={`nav-link${noBlog ? " active" : ""}`}>
          {t("nav.blog")}
        </Link>
        <span className="lang-toggle">
          {IDIOMAS_TOPO.map(idioma => (
            <button
              key={idioma}
              type="button"
              className={`lang-btn${locale === idioma ? " lang-btn-ativo" : ""}`}
              onClick={() => router.replace(pathname, { locale: idioma })}
              aria-label={t(`langSwitcher.${idioma}`)}
            >
              {idioma.toUpperCase()}
            </button>
          ))}
        </span>
      </nav>
    </header>
  );
}