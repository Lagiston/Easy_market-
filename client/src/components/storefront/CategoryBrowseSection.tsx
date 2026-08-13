import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, ImageIcon } from "lucide-react";
import { localize } from "@/lib/localize";
import { cn } from "@/lib/utils";
import type { StorefrontCategory } from "@/pages/storefront/ProductsPage";

const MAX_TILES_PER_ROW = 6;

function CategoryTile({ category }: { category: StorefrontCategory }) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const name = localize(category.name, language);

  return (
    <Link
      to={`/products?category=${category.id}`}
      aria-label={t("home.categories.tileAriaLabel", { name, count: category.itemCount })}
      className="group flex shrink-0 snap-start flex-col items-center"
    >
      <div
        className={cn(
          "relative size-[92px] overflow-hidden rounded-full bg-muted shadow-[0_0_0_1px_var(--border)]",
          "transition-all duration-300 group-hover:-translate-y-[3px]",
          "group-hover:shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-primary)_42%,transparent),0_14px_38px_-14px_color-mix(in_oklch,var(--color-primary)_50%,transparent)]",
          "motion-reduce:transition-none motion-reduce:group-hover:translate-y-0",
          "sm:size-[120px] lg:size-[136px]",
        )}
      >
        {category.imageUrl ? (
          <img
            src={category.imageUrl}
            alt=""
            className="size-full scale-100 object-cover transition-transform duration-[450ms] group-hover:scale-[1.07] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div aria-hidden className="flex size-full items-center justify-center">
            <ImageIcon className="size-8 text-muted-foreground/50 sm:size-9 lg:size-10" />
          </div>
        )}
      </div>
      <span className="mt-4 text-[13px] font-bold tracking-tight text-foreground sm:text-[15px]">
        {name}
      </span>
      <span className="mt-1 text-[12.5px] text-muted-foreground">
        {t("home.categories.itemCount", { count: category.itemCount })}
      </span>
    </Link>
  );
}

function CategoryRow({
  kicker,
  kickerClassName,
  categories,
}: {
  kicker: string;
  kickerClassName: string;
  categories: StorefrontCategory[];
}) {
  const { t } = useTranslation();

  return (
    <div className="mx-auto mt-14 max-w-[1240px] px-6 first:mt-0">
      <div className="flex items-center gap-3.5">
        <span className={cn("text-[11px] font-bold tracking-[0.14em] uppercase", kickerClassName)}>
          {kicker}
        </span>
        <div aria-hidden className="h-px flex-1 bg-foreground/10" />
        <Link
          to="/products"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("home.categories.viewAll")}
          <ArrowRight aria-hidden className="size-3.5 rtl:rotate-180" />
        </Link>
      </div>
      <div
        className={cn(
          "mt-6 flex items-start gap-5 overflow-x-auto snap-x snap-mandatory pb-1",
          "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "sm:gap-[26px] lg:flex-wrap lg:justify-center lg:gap-8 lg:overflow-visible",
        )}
      >
        {categories.map((category) => (
          <CategoryTile key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}

export default function CategoryBrowseSection({
  categories,
}: {
  categories: StorefrontCategory[] | undefined;
}) {
  const { t } = useTranslation();

  // The storefront /storefront/categories endpoint orders newest-first
  // (createdAt desc); reverse to oldest-first so the row reads in seeded
  // order (Wigs leading, Earrings trailing), not backwards.
  const lookGood = (categories ?? [])
    .filter((c) => c.homeRow === "look_good")
    .slice()
    .reverse()
    .slice(0, MAX_TILES_PER_ROW);

  if (lookGood.length === 0) return null;

  return (
    <section className="py-16">
      <CategoryRow
        kicker={t("home.categories.lookGoodKicker")}
        kickerClassName="text-primary"
        categories={lookGood}
      />
    </section>
  );
}
