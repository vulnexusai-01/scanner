"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Rodape() {
  const t = useTranslations();
  return (
    <footer className="footer">
      <div className="footer-logo">
        <img src="/vulnexusai.svg" alt="VulnexusAI" width={22} height={22} />
        <span>VulnexusAI</span>
      </div>
      <nav className="footer-nav">
        <Link href="/blog">{t("footerLinks.blog")}</Link>
        <Link href="/sobre">{t("footerLinks.sobre")}</Link>
        <Link href="/privacidade">{t("footerLinks.privacidade")}</Link>
        <Link href="/termos">{t("footerLinks.termos")}</Link>
        <Link href="/cookies">{t("footerLinks.cookies")}</Link>
      </nav>
      <p>{t("footer.nota")}</p>
    </footer>
  );
}
