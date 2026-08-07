import { Link } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, HandCoins, Store, Truck } from "lucide-react";
import type { LocalizedDescription, LocalizedName } from "@es-market/core";
import { localize } from "@/lib/localize";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollFrameAnimation } from "@/components/storefront/ScrollFrameAnimation";

const FEATURES = [
  { key: "payOnDelivery", Icon: HandCoins },
  { key: "delivery", Icon: Truck },
  { key: "pickup", Icon: Store },
] as const;

type PromoBlock = {
  id: string;
  headline: LocalizedName;
  copy: LocalizedDescription | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
};

// An external CTA URL navigates via a plain <a> (full page load); an internal
// one (starts with "/") uses a client-side <Link> instead, matching this
// codebase's link-heavy navigation style elsewhere (e.g. ProductVariantPicker).
function isInternalUrl(url: string) {
  return url.startsWith("/");
}

function PromoBlockCard({ promoBlock, language }: { promoBlock: PromoBlock; language: string }) {
  const cta = promoBlock.ctaLabel && promoBlock.ctaUrl && (
    isInternalUrl(promoBlock.ctaUrl) ? (
      <Link to={promoBlock.ctaUrl} className={buttonVariants({ size: "sm" })}>
        {promoBlock.ctaLabel}
      </Link>
    ) : (
      <a
        href={promoBlock.ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({ size: "sm" })}
      >
        {promoBlock.ctaLabel}
      </a>
    )
  );

  return (
    <Card>
      <CardContent className="space-y-2 p-6">
        <h2 className="text-lg font-semibold">{localize(promoBlock.headline, language)}</h2>
        {promoBlock.copy && (
          <p className="text-sm text-muted-foreground">{localize(promoBlock.copy, language)}</p>
        )}
        {cta}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";

  const { data: promoBlocks } = useQuery({
    queryKey: ["storefront", "promo-blocks"],
    queryFn: () =>
      axios
        .get<{ promoBlocks: PromoBlock[] }>("/api/storefront/promo-blocks")
        .then((res) => res.data.promoBlocks),
  });

  return (
    <div className="space-y-12">
      <ScrollFrameAnimation
        endChildren={
          <div className="w-full md:w-[380px]">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-[2px] w-[28px] bg-brand-orange drop-shadow-lg" />
              <span className="font-work-sans text-[13px] font-bold tracking-[0.18em] text-brand-orange uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                {t("home.introEyebrow")}
              </span>
            </div>
            <p className="mb-[12px] font-sora text-[30px] font-bold leading-[1.15] tracking-[-0.01em] text-intro-ink drop-shadow-lg">
              {t("home.introHeadlinePart1")}
              <span className="text-brand-orange">{t("home.introHeadlineHighlight")}</span>
              {t("home.introHeadlinePart2")}
            </p>
            <p className="mb-[16px] w-full max-w-md rounded-[16px] bg-intro-card/35 px-[26px] py-[22px] font-work-sans text-lg leading-[1.55] font-light text-intro-ink/72 backdrop-blur-[6px]">
              <span className="font-bold text-primary">{t("home.introBodyHighlight0")}</span>
              {t("home.introBodyPart1")}
              <span className="font-bold text-primary">{t("home.introBodyHighlight1")}</span>
              {t("home.introBodyPart2")}
              <span className="font-bold text-primary">{t("home.introBodyHighlight2")}</span>
              {t("home.introBodyPart3")}
            </p>
            <Link
              to="/products"
              className="inline-block border-b border-brand-orange pb-0.5 font-work-sans text-[15px] font-medium text-white drop-shadow-lg outline-none hover:opacity-80 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {t("home.introCta")}
            </Link>
          </div>
        }
        outroChildren={
          <p className="font-dm-sans text-lg text-white/80 drop-shadow-lg md:text-xl">
            {t("home.outroLine")}
          </p>
        }
      >
        <div className="space-y-6 font-dm-sans md:space-y-8">
          <p className="text-sm font-bold tracking-[0.3em] text-primary">{t("home.eyebrow")}</p>
          <h1 className="text-6xl leading-[0.94] font-black tracking-tight md:text-8xl">
            <span className="block text-white drop-shadow-lg">{t("home.headlineLine1")}</span>
            <span className="block text-primary drop-shadow-lg">{t("home.headlineLine2")}</span>
          </h1>
          <p className="max-w-md text-lg text-brand-orange">{t("home.subline")}</p>
          <Link
            to="/products"
            className={cn(
              buttonVariants({ size: "lg" }),
              "rounded-full bg-primary font-bold text-white hover:bg-primary/90",
            )}
          >
            {t("home.cta")}
            <ArrowRight data-icon="inline-end" className="rtl:rotate-180" />
          </Link>
        </div>
      </ScrollFrameAnimation>
      <div className="mx-auto max-w-5xl space-y-12">
        {promoBlocks && promoBlocks.length > 0 && (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promoBlocks.map((promoBlock) => (
              <PromoBlockCard key={promoBlock.id} promoBlock={promoBlock} language={language} />
            ))}
          </section>
        )}
        <section className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ key, Icon }) => (
            <Card key={key}>
              <CardContent className="space-y-2 p-6">
                <Icon aria-hidden className="size-6 text-primary" />
                <h2 className="font-medium">{t(`home.features.${key}.title`)}</h2>
                <p className="text-sm text-muted-foreground">
                  {t(`home.features.${key}.text`)}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
