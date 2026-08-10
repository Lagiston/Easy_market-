import { useState, type CSSProperties } from "react";
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
  { key: "payOnDelivery", Icon: HandCoins, color: "#22c55e", href: "/checkout" },
  { key: "delivery", Icon: Truck, color: "#3b82f6", href: "/track" },
  // Matches --color-brand-orange (client/src/index.css) — a plain hex, not the
  // CSS var itself, since this string also gets an alpha suffix appended
  // below (e.g. `${color}55`), which only works on a hex literal.
  { key: "pickup", Icon: Store, color: "#ff5a1f", href: "/contact" },
] as const;

// f_auto/q_auto let Cloudinary pick the best codec/quality for the
// requesting browser; the mobile variant additionally caps the delivered
// width (w_800,c_scale) so phones on metered connections don't pull the
// same full-resolution file as desktop.
const VIDEO_SECTION_SRC_MOBILE =
  "https://res.cloudinary.com/first1/video/upload/f_auto,q_auto,w_800,c_scale/v1786219391/Cosmetics_dropping_into_bag_202608082258_d2xsig.mp4";
const VIDEO_SECTION_SRC =
  "https://res.cloudinary.com/first1/video/upload/f_auto,q_auto/v1786219391/Cosmetics_dropping_into_bag_202608082258_d2xsig.mp4";
// Cloudinary auto-generates a first-frame thumbnail for any video asset at
// the same delivery URL with the extension swapped to an image format.
const VIDEO_SECTION_POSTER =
  "https://res.cloudinary.com/first1/video/upload/f_auto,q_auto/v1786219391/Cosmetics_dropping_into_bag_202608082258_d2xsig.jpg";

function FeatureCard({
  feature,
  t,
}: {
  feature: (typeof FEATURES)[number];
  t: (key: string) => string;
}) {
  const { key, Icon, color, href } = feature;

  const wrapperClassName =
    "block h-full rounded-3xl outline-none transition-all duration-300 hover:-translate-y-1 shadow-[0_0_60px_-15px_var(--glow-color)] hover:shadow-[0_0_90px_-10px_var(--glow-color)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-white";
  const wrapperStyle = { "--glow-color": color } as CSSProperties;

  const cardContent = (
    <Card className="ring-0 relative flex h-full min-h-[340px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 p-8">
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 50% 115%, ${color}55 0%, transparent 70%)`,
        }}
      />
      <div className="relative z-10 flex h-full flex-col">
        <div
          className="flex size-11 items-center justify-center rounded-xl border bg-white/10 backdrop-blur-sm"
          style={{ borderColor: `${color}40` }}
        >
          <Icon aria-hidden className="size-5" style={{ color }} />
        </div>
        <h2 className="mt-6 text-2xl font-medium tracking-tight text-white">
          {t(`home.features.${key}.title`)}
        </h2>
        <p className="mt-2 max-w-[30ch] text-sm leading-relaxed text-white/70">
          {t(`home.features.${key}.text`)}
        </p>
        <span
          aria-hidden
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-white"
        >
          {t(`home.features.${key}.link`)}
          <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
        </span>
      </div>
    </Card>
  );

  return (
    <Link
      to={href}
      aria-label={t(`home.features.${key}.title`)}
      className={wrapperClassName}
      style={wrapperStyle}
    >
      {cardContent}
    </Link>
  );
}

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
  const [prefersReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

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
        endChildren={{
          eyebrow: (
            <div className="mb-3 flex items-center gap-2">
              <span className="h-[2px] w-[28px] bg-brand-orange drop-shadow-lg" />
              <span className="font-work-sans text-[13px] font-bold tracking-[0.18em] text-brand-orange uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                {t("home.introEyebrow")}
              </span>
            </div>
          ),
          headline: (
            <p className="mb-[12px] font-sora text-[30px] font-bold leading-[1.15] tracking-[-0.01em] text-intro-ink drop-shadow-lg">
              {t("home.introHeadlinePart1")}
              <span className="text-brand-orange">{t("home.introHeadlineHighlight")}</span>
              {t("home.introHeadlinePart2")}
            </p>
          ),
          body: (
            <p className="mb-[16px] w-full max-w-md rounded-[16px] bg-intro-card/35 px-[26px] py-[22px] font-work-sans text-lg leading-[1.55] font-light text-intro-ink/72 backdrop-blur-[6px]">
              <span className="font-bold text-primary">{t("home.introBodyHighlight0")}</span>
              {t("home.introBodyPart1")}
              <span className="font-bold text-primary">{t("home.introBodyHighlight1")}</span>
              {t("home.introBodyPart2")}
              <span className="font-bold text-primary">{t("home.introBodyHighlight2")}</span>
              {t("home.introBodyPart3")}
            </p>
          ),
          cta: (
            <Link
              to="/products"
              className="inline-block border-b border-brand-orange pb-0.5 font-work-sans text-[15px] font-medium text-white drop-shadow-lg outline-none hover:opacity-80 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              {t("home.introCta")}
            </Link>
          ),
        }}
        outroChildren={
          <p className="font-dm-sans text-lg text-white/80 drop-shadow-lg md:text-xl">
            {t("home.outroLinePart1")}
            <span className="font-bold text-primary drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
              {t("home.outroLineHighlight")}
            </span>
            {t("home.outroLinePart2")}
          </p>
        }
      >
        <div className="space-y-6 font-dm-sans md:space-y-8">
          <p className="text-sm font-bold tracking-[0.1em] text-primary">{t("home.eyebrow")}</p>
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
      {promoBlocks && promoBlocks.length > 0 && (
        <div className="mx-auto max-w-5xl px-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {promoBlocks.map((promoBlock) => (
              <PromoBlockCard key={promoBlock.id} promoBlock={promoBlock} language={language} />
            ))}
          </section>
        </div>
      )}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground">
            {t("home.features.heading")}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {t("home.features.subheading")}
          </p>
          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.key} feature={feature} t={t} />
            ))}
          </div>
        </div>
      </section>
      <section className="relative flex h-screen items-center justify-center overflow-hidden bg-neutral-950">
        <video
          className="absolute inset-0 size-full object-cover"
          poster={VIDEO_SECTION_POSTER}
          preload={prefersReducedMotion ? "metadata" : "auto"}
          autoPlay={!prefersReducedMotion}
          muted
          loop
          playsInline
          aria-hidden
        >
          <source src={VIDEO_SECTION_SRC_MOBILE} media="(max-width: 767px)" type="video/mp4" />
          <source src={VIDEO_SECTION_SRC} type="video/mp4" />
        </video>
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/50"
        />
        <div className="relative z-10 px-6 text-center">
          <p className="font-dm-sans text-3xl font-bold text-white drop-shadow-lg md:text-5xl">
            {t("home.videoSection.tagline")}
          </p>
          <Link
            to="/products"
            className={cn(
              buttonVariants({ size: "lg" }),
              "mt-6 rounded-full bg-primary font-bold text-white hover:bg-primary/90",
            )}
          >
            {t("home.videoSection.cta")}
            <ArrowRight data-icon="inline-end" className="rtl:rotate-180" />
          </Link>
        </div>
      </section>
    </div>
  );
}
