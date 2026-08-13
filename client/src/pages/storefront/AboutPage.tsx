import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { HandCoins, Sparkles, Users, type LucideIcon } from "lucide-react";
import { DEFAULT_SITE_CONTENT, type SiteContentKey } from "@es-market/core";
import { usePublicSiteContent } from "@/lib/site-content";
import { buttonVariants } from "@/components/ui/button";

const VALUES = [
  { key: "valueQuality", contentKey: "about_valueQualityBody", Icon: Sparkles },
  { key: "valueService", contentKey: "about_valueServiceBody", Icon: Users },
  { key: "valueCommunity", contentKey: "about_valueCommunityBody", Icon: HandCoins },
] as const satisfies readonly { key: string; contentKey: SiteContentKey; Icon: LucideIcon }[];

export default function AboutPage() {
  const { t, i18n } = useTranslation();
  const { data: siteContent } = usePublicSiteContent();

  // Admin-edited body content is English-only (see core/src/schemas/site-content.ts)
  // — non-English visitors keep the static i18n translations instead.
  const isEnglish = i18n.resolvedLanguage === "en";
  const body = (key: SiteContentKey, i18nKey: string) =>
    isEnglish ? (siteContent?.[key] ?? DEFAULT_SITE_CONTENT[key]) : t(i18nKey);

  return (
    <div className="relative -mx-6 -my-8 min-h-[calc(100vh-1px)] overflow-hidden bg-background px-6 py-14 font-dm-sans text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(14,165,233,0.16)_0%,transparent_70%)] reduced-transparency:hidden"
      />
      <div className="relative mx-auto max-w-[900px] space-y-12">
        <div className="space-y-3 text-center">
          <h1 className="text-[44px] font-extrabold tracking-[-0.035em]">{t("about.title")}</h1>
          <p className="text-muted-foreground">{t("about.subtitle")}</p>
        </div>

        <div className="space-y-4 rounded-[20px] border border-foreground/10 bg-card/40 p-8 backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none">
          <h2 className="text-2xl font-bold tracking-tight">{t("about.storyHeading")}</h2>
          <p className="text-muted-foreground">{body("about_storyBody1", "about.storyBody1")}</p>
          <p className="text-muted-foreground">{body("about_storyBody2", "about.storyBody2")}</p>
        </div>

        <div className="space-y-6">
          <h2 className="text-center text-2xl font-bold tracking-tight">
            {t("about.valuesHeading")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {VALUES.map(({ key, contentKey, Icon }) => (
              <div
                key={key}
                className="space-y-3 rounded-[20px] border border-foreground/10 bg-card/40 p-6 backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none"
              >
                <div className="flex size-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-5" />
                </div>
                <h3 className="font-bold">{t(`about.${key}Title`)}</h3>
                <p className="text-sm text-muted-foreground">
                  {body(contentKey, `about.${key}Body`)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <Link to="/products" className={buttonVariants({ size: "lg" })}>
            {t("about.cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
