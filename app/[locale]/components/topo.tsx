"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";

export default function Topo({ mostraHistorico = false }: { mostraHistorico?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const naHome = pathname === "/";
  const verificarHref = naHome ? "#verificar" : "/#verificar";
  const historicoHref = naHome ? "#historico" : "/#historico";

  return (
    <header className="topo">
      <Link href="/" className="logo">
        <img src="/vulnexusai.svg" alt="VulnexusAI" className="logo-img" width={34} height={34} />
        <span className="logo-txt">Vulnexus<span>AI</span></span>
      </Link>
      <nav>
        <Link href={verificarHref} className="nav-link">{t("nav.verificar")}</Link>
        {mostraHistorico && <Link href={historicoHref} className="nav-link">{t("nav.historico")}</Link>}
        <span className="lang-toggle">
          <button
            type="button"
            className={`lang-btn${locale === "pt" ? " lang-btn-ativo" : ""}`}
            onClick={() => router.replace(pathname, { locale: "pt" })}
            aria-label={t("langSwitcher.pt")}
          >
            PT
          </button>
          <button
            type="button"
            className={`lang-btn${locale === "en" ? " lang-btn-ativo" : ""}`}
            onClick={() => router.replace(pathname, { locale: "en" })}
            aria-label={t("langSwitcher.en")}
          >
            EN
          </button>
        </span>
      </nav>
    </header>
  );
}
