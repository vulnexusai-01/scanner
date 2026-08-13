import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { LocaleArtigo } from "@/lib/blog";

export default async function VerificarCta({ locale }: { locale: LocaleArtigo }) {
  const t = await getTranslations({ locale, namespace: "blog" });
  return (
    <div className="cta-verificar">
      <strong>{t("verificarCta.titulo")}</strong>
      <p>{t("verificarCta.texto")}</p>
      <Link href="/#verificar">{t("verificarCta.botao")}</Link>
    </div>
  );
}
