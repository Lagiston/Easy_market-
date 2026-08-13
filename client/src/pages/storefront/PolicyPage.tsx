import { useEffect } from "react";
import { useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { DEFAULT_SITE_CONTENT, type SiteContentKey } from "@es-market/core";
import { usePublicSiteContent } from "@/lib/site-content";

const SECTIONS = [
  { key: "returns", body1: "policy_returnsBody1", body2: "policy_returnsBody2" },
  { key: "privacy", body1: "policy_privacyBody1", body2: "policy_privacyBody2" },
  { key: "terms", body1: "policy_termsBody1", body2: "policy_termsBody2" },
] as const satisfies readonly { key: string; body1: SiteContentKey; body2: SiteContentKey }[];

export default function PolicyPage() {
  const { t, i18n } = useTranslation();
  const { hash } = useLocation();
  const { data: siteContent } = usePublicSiteContent();

  // Admin-edited body content is English-only (see core/src/schemas/site-content.ts)
  // — non-English visitors keep the static i18n translations instead.
  const isEnglish = i18n.resolvedLanguage === "en";
  const body = (key: SiteContentKey, i18nKey: string) =>
    isEnglish ? (siteContent?.[key] ?? DEFAULT_SITE_CONTENT[key]) : t(i18nKey);

  // React Router's client-side navigation doesn't trigger the browser's
  // native scroll-to-hash behavior (that only fires on a full page load),
  // so a deep link like /policy#returns needs an explicit scroll here.
  useEffect(() => {
    if (!hash) return;
    const target = document.getElementById(hash.slice(1));
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div className="relative -mx-6 -my-8 min-h-[calc(100vh-1px)] overflow-hidden bg-background px-6 py-14 font-dm-sans text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(14,165,233,0.16)_0%,transparent_70%)] reduced-transparency:hidden"
      />
      <div className="relative mx-auto max-w-[900px] space-y-10">
        <div className="space-y-3 text-center">
          <h1 className="text-[44px] font-extrabold tracking-[-0.035em]">{t("policy.title")}</h1>
          <p className="text-muted-foreground">{t("policy.subtitle")}</p>
        </div>

        <div className="space-y-6">
          {SECTIONS.map(({ key, body1, body2 }) => (
            <div
              key={key}
              id={key}
              className="scroll-mt-24 space-y-4 rounded-[20px] border border-foreground/10 bg-card/40 p-8 backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none"
            >
              <h2 className="text-2xl font-bold tracking-tight">{t(`policy.${key}Heading`)}</h2>
              <p className="text-muted-foreground">{body(body1, `policy.${key}Body1`)}</p>
              <p className="text-muted-foreground">{body(body2, `policy.${key}Body2`)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
