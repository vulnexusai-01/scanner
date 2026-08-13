"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Rodape() {
  const t = useTranslations();
  return (
    <footer className="footer">
      <div className="foot-logo">
        <span className="logo-mark" style={{ width: 22, height: 22, fontSize: 11 }}>
          V
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