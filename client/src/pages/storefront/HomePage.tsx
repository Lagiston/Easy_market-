import { Link } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { HandCoins, Store, Truck } from "lucide-react";
import type { LocalizedDescription, LocalizedName } from "@es-market/core";
import { localize } from "@/lib/localize";
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
      <ScrollFrameAnimation />
      <div className="mx-auto max-w-5xl space-y-12">
        <section className="grid items-center gap-8 py-8 text-center md:grid-cols-2 md:text-start">
          <h1 className="text-5xl font-bold tracking-tight text-primary md:text-6xl">
            {t("home.title")}
          </h1>
          <div className="space-y-4">
            <p className="text-lg text-muted-foreground">{t("home.subtitle")}</p>
            <Link to="/products" className={buttonVariants({ size: "lg" })}>
              {t("home.cta")}
            </Link>
          </div>
        </section>
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
