import { useState, type CSSProperties } from "react";
import { Link } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Gem, HandCoins, LayoutGrid, Sparkles, Store, Truck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { LocalizedDescription, LocalizedName } from "@es-market/core";
import { localize } from "@/lib/localize";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollFrameAnimation } from "@/components/storefront/ScrollFrameAnimation";
import CategoryBrowseSection from "@/components/storefront/CategoryBrowseSection";
import type { StorefrontCategory } from "@/pages/storefront/ProductsPage";

// One decorative accent (orange, --hero-accent) for the pillar icons —
// matches the kicker/headline highlight in the "Our story" card above.
const OUR_STORY_PILLARS: { key: "brand" | "category" | "wear"; Icon: LucideIcon }[] = [
  { key: "brand", Icon: Gem },
  { key: "category", Icon: LayoutGrid },
  { key: "wear", Icon: Sparkles },
];

const FEATURES = [
  {
    key: "payOnDelivery",
    Icon: HandCoins,
    iconColor: "#10b981",
    glowColor: "rgba(16,185,129,.42)",
    href: "/checkout",
  },
  {
    key: "delivery",
    Icon: Truck,
    iconColor: "#3b82f6",
    glowColor: "rgba(59,130,246,.42)",
    href: "/track",
  },
  {
    key: "pickup",
    Icon: Store,
    // Matches --color-brand-orange (client/src/index.css).
    iconColor: "#ff5a1f",
    glowColor: "rgba(255,90,31,.42)",
    href: "/contact",
  },
] as const;

// f_auto/q_auto let Cloudinary pick the best codec/quality for the
// requesting browser; the mobile variant additionally caps the delivered
// width (w_800,c_scale) so phones on metered connections don't pull the
// same full-resolution file as desktop.
const VIDEO_SECTION_SRC_MOBILE =
  "https://res.cloudinary.com/first1/video/upload/f_auto,q_auto,w_800,c_scale/v1786986431/gfvfdjwbfxwvgnxebbdh.mp4";
const VIDEO_SECTION_SRC =
  "https://res.cloudinary.com/first1/video/upload/f_auto,q_auto/v1786986431/gfvfdjwbfxwvgnxebbdh.mp4";
// Cloudinary auto-generates a first-frame thumbnail for any video asset at
// the same delivery URL with the extension swapped to an image format.
const VIDEO_SECTION_POSTER =
  "https://res.cloudinary.com/first1/video/upload/f_auto,q_auto/v1786986431/gfvfdjwbfxwvgnxebbdh.jpg";

function FeatureCard({
  feature,
  t,
}: {
  feature: (typeof FEATURES)[number];
  t: (key: string) => string;
}) {
  const { key, Icon, iconColor, glowColor, href } = feature;

  // The glow lives on a -z-10 pseudo-element inside an `isolate` stacking
  // context (not a box-shadow on the card itself) so it can't bleed past
  // its own layer into neighboring cards as a neon halo. `group` lets the
  // link's own arrow gap react to hovering anywhere on the card, not just
  // the arrow itself.
  const wrapperClassName =
    "group relative isolate block h-full rounded-[20px] outline-none transition-all duration-300 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-white before:absolute before:inset-0 before:-z-10 before:rounded-[20px] before:bg-[var(--glow-color)] before:opacity-55 before:blur-2xl before:transition-opacity before:duration-300 before:content-[''] hover:before:opacity-85";
  const wrapperStyle = { "--glow-color": glowColor } as CSSProperties;

  return (
    <Link
      to={href}
      aria-label={t(`home.features.${key}.title`)}
      className={wrapperClassName}
      style={wrapperStyle}
    >
      {/* bg-neutral-950 is the sanctioned always-dark base these cards keep
          regardless of site theme (see the CLAUDE.md note on this section);
          the translucent white gradient is layered on top of it as a sheen,
          not used as the card's only background — the page shell behind
          this section follows the light/dark toggle, so a purely translucent
          card would go illegible-on-white in light mode. */}
      <Card className="ring-0 relative isolate flex h-full min-h-[250px] flex-col overflow-hidden rounded-[20px] border border-white/[0.08] bg-neutral-950 bg-[linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015))] p-6.5">
        <div className="flex size-[42px] items-center justify-center rounded-xl border border-white/[0.14] bg-white/[0.09] backdrop-blur">
          <Icon aria-hidden className="size-5" style={{ color: iconColor }} />
        </div>
        <h3 className="mt-6 text-[21px] font-semibold tracking-tight text-white">
          {t(`home.features.${key}.title`)}
        </h3>
        <p className="mt-2 max-w-[30ch] text-[13.5px] leading-relaxed text-white/70">
          {t(`home.features.${key}.text`)}
        </p>
        <span
          aria-hidden
          className="mt-auto inline-flex w-fit items-center gap-1.5 pt-4.5 text-sm font-semibold text-white transition-[gap] duration-300 group-hover:gap-3 motion-reduce:transition-none"
        >
          {t(`home.features.${key}.link`)}
          <ArrowRight aria-hidden className="size-4 rtl:rotate-180" />
        </span>
      </Card>
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

  // Same query key ProductsPage.tsx's own category-filter fetch uses, so
  // both pages share one cache entry.
  const { data: categories } = useQuery({
    queryKey: ["storefront", "categories"],
    queryFn: () =>
      axios
        .get<{ categories: StorefrontCategory[] }>("/api/storefront/categories")
        .then((res) => res.data.categories),
  });

  // The editorial banner's CTA points at a specific category (not the
  // generic product list) — falls back to the unfiltered list if "Makeup"
  // hasn't been created/renamed in this environment yet.
  const beautyCategory = categories?.find((c) => c.name.en === "Makeup");
  const beautyHref = beautyCategory ? `/products?category=${beautyCategory.id}` : "/products";

  return (
    <div>
      {/* Full-bleed: cancels StorefrontLayout's <main> px-6 py-8 (24px/32px)
          and pulls the extra 88px up under the floating sticky nav, so the
          photo runs edge to edge instead of sitting in a boxed/margined card. */}
      <div className="relative -mx-6 -mt-[120px]">
        <ScrollFrameAnimation
          endChildren={
            // Panel chrome (pill card, backdrop-blur, glow, photo) removed —
            // just the kicker/headline/paragraph left, floating directly over
            // the hero photo like the left-side headline block. drop-shadow-lg
            // on each piece keeps it legible without a card behind it, same
            // convention pillarsChildren already uses for its own floating text.
            <div className="flex w-[360px] max-w-[70vw] flex-col items-center gap-6 px-4 text-center font-archivo sm:px-6">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-px w-[30px] bg-hero-accent drop-shadow-lg" />
                <span className="text-sm font-bold tracking-[0.32em] text-hero-accent uppercase drop-shadow-lg">
                  {t("home.ourStory.kicker")}
                </span>
              </div>

              <p className="text-[26px] leading-[1.3] font-extrabold tracking-[-0.02em] text-hero-fg text-balance drop-shadow-lg sm:text-[32px]">
                {t("home.ourStory.headlinePart1")}
                <span className="text-hero-accent">{t("home.ourStory.headlineHighlight")}</span>
                {t("home.ourStory.headlinePart2")}
              </p>

              <p className="max-w-[400px] text-lg leading-[1.85] text-hero-muted text-pretty drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                {t("home.ourStory.body")}
              </p>
            </div>
          }
          pillarsChildren={OUR_STORY_PILLARS.map(({ key, Icon }) => (
            <div key={key} className="flex items-start gap-2.75">
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-hero-accent drop-shadow-lg" />
              <div>
                <p className="text-sm font-semibold text-hero-fg drop-shadow-lg">
                  {t(`home.ourStory.pillars.${key}.label`)}
                </p>
                <p className="text-[12.5px] text-hero-muted drop-shadow-lg">
                  {t(`home.ourStory.pillars.${key}.text`)}
                </p>
              </div>
            </div>
          ))}
        >
          <div className="space-y-6 font-dm-sans md:space-y-8">
            <p className="text-sm font-bold tracking-[0.1em] text-primary">{t("home.eyebrow")}</p>
            <h1 className="max-w-[13ch] text-[clamp(46px,6.6vw,92px)] leading-[0.96] font-black tracking-[-0.035em]">
              <span className="block text-hero-fg drop-shadow-lg transition-colors duration-300 motion-reduce:transition-none">
                {t("home.headlineLine1")}
              </span>
              <span className="block text-hero-accent drop-shadow-lg transition-colors duration-300 motion-reduce:transition-none">
                {t("home.headlineLine2")}
              </span>
            </h1>
            <p className="max-w-[40ch] text-lg text-hero-muted transition-colors duration-300 motion-reduce:transition-none">
              {t("home.subline")}
            </p>
            <Link
              to="/products"
              className="group relative isolate inline-flex h-[52px] items-center gap-2 rounded-[13px] border border-primary/40 bg-[linear-gradient(135deg,oklch(0.22_0.03_236)_0%,oklch(0.32_0.08_236)_50%,oklch(0.5_0.13_236)_100%)] px-7 font-bold text-hero-brand-ink outline-none transition-[filter] duration-300 hover:brightness-125 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-hero-fg motion-reduce:transition-none"
            >
              {t("home.cta")}
              <ArrowRight
                data-icon="inline-end"
                className="rtl:rotate-180 transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              />
            </Link>
          </div>
        </ScrollFrameAnimation>
      </div>
      <CategoryBrowseSection categories={categories} />
      {promoBlocks && promoBlocks.length > 0 && (
        <section className="py-16">
          <div className="mx-auto max-w-[1240px] px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {promoBlocks.map((promoBlock) => (
                <PromoBlockCard key={promoBlock.id} promoBlock={promoBlock} language={language} />
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="py-16">
        <div className="mx-auto max-w-[1240px] px-6">
          <h2 className="text-4xl font-semibold tracking-tight text-foreground">
            {t("home.features.heading")}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {t("home.features.subheading")}
          </p>
          <div className="mt-10 grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            {FEATURES.map((feature) => (
              <FeatureCard key={feature.key} feature={feature} t={t} />
            ))}
          </div>
        </div>
      </section>
      {/* Full-bleed, same as the hero: -mx-6 cancels StorefrontLayout's
          <main> px-6, and h-screen matches the hero's sticky viewport
          height so the two full-bleed sections read as the same size. */}
      <section className="-mx-6">
        {/* Now rounded on all four corners (was top-only) and carries the
            same "dark arctic-paradise" bottom shadow as the hero — the
            shadow has to live on this outer, unclipped box since box-shadow
            is clipped by overflow-hidden on the same element; the video/scrim
            keep their clipping on the inner wrapper below, same split as
            ScrollFrameAnimation.tsx's hero sections. */}
        <div className="relative h-screen rounded-3xl shadow-[0_20px_35px_-15px_rgba(11,31,51,0.4)] dark:shadow-[0_20px_35px_-15px_rgba(11,31,51,0.65)]">
          <div className="absolute inset-0 overflow-hidden rounded-3xl bg-neutral-950">
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
            {/* Bottom-weighted scrim: fully opaque at the bottom (where the
                copy sits) fading to transparent at the top, so the image
                itself stays the focus rather than being darkened uniformly. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 p-8 md:p-12">
            <p className="font-dm-sans text-3xl font-bold text-white drop-shadow-lg md:text-5xl">
              {t("home.videoSection.headline")}
            </p>
            <p className="mt-3 max-w-md text-sm text-white/80 drop-shadow-lg md:text-base">
              {t("home.videoSection.sublinePart1")}
              <span className="text-brand-orange">{t("home.videoSection.sublineHighlight")}</span>
              {t("home.videoSection.sublinePart2")}
            </p>
            <Link
              to={beautyHref}
              className="group relative isolate mt-6 inline-flex h-[52px] items-center gap-2 rounded-[13px] border border-primary/40 bg-[linear-gradient(135deg,oklch(0.22_0.03_236)_0%,oklch(0.32_0.08_236)_50%,oklch(0.5_0.13_236)_100%)] px-7 font-bold text-hero-brand-ink outline-none transition-[filter] duration-300 hover:brightness-125 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-4 focus-visible:outline-hero-fg motion-reduce:transition-none"
            >
              {t("home.videoSection.cta")}
              <ArrowRight
                data-icon="inline-end"
                className="rtl:rotate-180 transition-transform duration-300 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
              />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
