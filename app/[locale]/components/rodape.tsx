"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Rodape() {
  const t = useTranslations();
  return (
    <footer className="footer">
      <div className="foot-logo">
        <span className="logo-mark sm" aria-hidden="true">
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
        VulnexusAI
      </div>
      <nav className="foot-links">
        <Link href="/blog">{t("footerLinks.blog")}</Link>
        <Link href="/sobre">{t("footerLinks.sobre")}</Link>
        <Link href="/privacidade">{t("footerLinks.privacidade")}</Link>
        <Link href="/termos">{t("footerLinks.termos")}</Link>
        <Link href="/cookies">{t("footerLinks.cookies")}</Link>
      </nav>
      <p className="foot-note">{t("footer.nota")}</p>
    </footer>
  );
}