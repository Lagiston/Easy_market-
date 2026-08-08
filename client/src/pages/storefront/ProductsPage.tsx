import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link, useSearchParams } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, ImageOff, Search, ShoppingCart, Star, X } from "lucide-react";
import {
  STOREFRONT_AVAILABILITY_FILTERS,
  STOREFRONT_PAGE_SIZE,
  STOREFRONT_PRODUCT_SORTS,
  type LocalizedDescription,
  type LocalizedName,
  type StorefrontAvailabilityFilter,
  type StorefrontProductSort,
} from "@es-market/core";
import { localize } from "@/lib/localize";
import { useCart } from "@/lib/cart";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { useWishlist } from "@/lib/wishlist";
import WishlistButton from "@/components/storefront/WishlistButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StorefrontProduct = {
  id: string;
  name: LocalizedName;
  description: LocalizedDescription | null;
  price: number;
  // Nullable discounted price — null means "not on sale". When set, the
  // card shows this as the current price with `price` struck through
  // beside it as the original (server/prisma/schema.prisma's Product.salePrice).
  salePrice: number | null;
  stock: number;
  // Same low-stock bound as the admin catalog's getStockStatus
  // (client/src/components/ProductsTable.tsx) and the dashboard's low-stock
  // count — stock > 0 && stock < lowStockThreshold. Duplicated rather than
  // shared since that's the existing precedent for this exact check (see
  // CLAUDE.md's dashboard bullet); keep all three in sync if it changes.
  lowStockThreshold: number;
  images: string[];
  tags: string[];
  // Variant-distinguishing labels (e.g. "M", "Red") — null when not set.
  // Drives whether ProductDetailPage shows a variant picker instead of the
  // plain related-products grid.
  size: string | null;
  color: string | null;
  category: { id: string; name: LocalizedName };
  // null (not 0) when unreviewed — the card omits the rating line entirely.
  averageRating: number | null;
  reviewCount: number;
  // Social proof — how many *other* customers have this saved. Always a
  // plain number (no unknown/unset state to distinguish, unlike
  // averageRating). Never the viewer's own wishlist membership — that's a
  // separate, signed-in-only signal (see WishlistButton's isWishlisted).
  wishlistCount: number;
  createdAt: string;
};

type StorefrontCategory = { id: string; name: LocalizedName };

const ALL_CATEGORIES = "all";
const ALL_TAGS = "all";

const SORT_LABEL_KEYS: Record<StorefrontProductSort, string> = {
  newest: "products.filters.newest",
  "price-asc": "products.filters.priceAsc",
  "price-desc": "products.filters.priceDesc",
};

const AVAILABILITY_LABEL_KEYS: Record<StorefrontAvailabilityFilter, string> = {
  all: "products.filters.allAvailability",
  inStock: "products.filters.inStock",
  onSale: "products.filters.onSale",
};

// A product counts as "New" for the badge purely from how recently it was
// created — no separate flag exists (or is worth adding) for this.
const NEW_BADGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// A rapid double-click can fire both click handlers before React commits a
// state update — even a `useState` guard checked in the same synchronous
// event-dispatch stack still reads the pre-update value for the second
// click, so both handlers see the same stale `cartItems` and each shows its
// own toast. This window disables the button per-product just long enough
// for a real re-render to land, collapsing an accidental double-click into
// one add and one toast.
const ADD_TO_CART_GUARD_MS = 400;

const CHIP_CLASS =
  "shrink-0 whitespace-nowrap rounded-full border border-foreground/10 bg-card/60 px-[18px] py-2.5 text-sm text-muted-foreground backdrop-blur-xl transition-all hover:border-foreground/20 hover:bg-accent hover:text-foreground reduced-transparency:bg-card reduced-transparency:backdrop-blur-none";
const CHIP_ACTIVE_CLASS =
  "border-foreground bg-foreground font-bold text-background hover:bg-foreground hover:text-background";

const FIELD_LABEL_CLASS =
  "mb-2 text-[11px] leading-tight font-semibold tracking-[0.09em] text-muted-foreground uppercase";
const CONTROL_CLASS =
  "h-11 min-w-0 rounded-xl border-foreground/10 bg-card/40 px-3.5 text-sm hover:border-foreground/20 focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/[0.16] reduced-transparency:bg-card";
const SELECT_CONTROL_CLASS =
  "h-11 w-full min-w-0 rounded-xl border-foreground/10 bg-card/40 text-sm hover:border-foreground/20 focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/[0.16] reduced-transparency:bg-card data-[size=default]:h-11";
const FILTER_PILL_CLASS =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-foreground/10 bg-card/60 py-1.5 ps-3 pe-2 text-[12.5px] text-foreground reduced-transparency:bg-card";

type StockStatus = "inStock" | "lowStock" | "soldOut";

function getStockStatus(product: StorefrontProduct): StockStatus {
  if (product.stock === 0) return "soldOut";
  if (product.stock < product.lowStockThreshold) return "lowStock";
  return "inStock";
}

// Quick-add-bar action for an out-of-stock card. Reuses the same
// wishlist-add mechanism as WishlistButton — this codebase has no separate
// "notify me" infrastructure (no email/push exists anywhere; see CLAUDE.md's
// "Notify me when back in stock" bullet), so "Notify me" here just means
// "add to wishlist", the actual read-time back-in-stock signal.
function NotifyMeBar({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const { data: session } = customerAuthClient.useSession();
  const { isWishlisted, addMutation } = useWishlist();

  const barClassName =
    "absolute inset-x-3 bottom-3 flex h-[42px] translate-y-3 items-center justify-center gap-1.5 rounded-xl border border-foreground/20 bg-background/70 text-sm font-bold text-foreground opacity-0 backdrop-blur transition-all duration-[260ms] group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none reduced-transparency:bg-background reduced-transparency:backdrop-blur-none [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100";

  if (!session) {
    return (
      <Link to="/account/login" className={barClassName}>
        <Bell className="size-4" /> {t("products.notifyMe")}
      </Link>
    );
  }

  const notified = isWishlisted(productId);

  return (
    <button
      type="button"
      className={barClassName}
      disabled={notified || addMutation.isPending}
      onClick={() => addMutation.mutate(productId)}
    >
      <Bell className="size-4" /> {t("products.notifyMe")}
    </button>
  );
}

export default function ProductsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const { items: cartItems, addItem } = useCart();
  // Source of truth for the guard is a ref, not state: a ref mutates
  // synchronously, so even two clicks dispatched within the same JS task
  // (a genuinely instant double-click) see each other's write immediately.
  // `pendingAddTick` exists only to trigger the re-render that reflects the
  // ref's current contents in the button's `disabled` prop.
  const pendingAddIdsRef = useRef<Set<string>>(new Set());
  const [, setPendingAddTick] = useState(0);

  // `tag` is read-once, not two-way synced: lets a link (e.g. a tag chip on
  // the product detail page) land here pre-filtered, without making every
  // filter change round-trip through the URL. `page` *is* synced back below
  // (replacing, not pushing, so pagination doesn't spam browser history) —
  // otherwise browser back-navigation from a product detail page always
  // remounts this page at page 1, since nothing in the URL recorded which
  // page the visitor was on.
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [tag, setTag] = useState(() => searchParams.get("tag") ?? ALL_TAGS);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [debouncedPrices, setDebouncedPrices] = useState({ minPrice: "", maxPrice: "" });
  const [sort, setSort] = useState<StorefrontProductSort>("newest");
  const [availability, setAvailability] = useState<StorefrontAvailabilityFilter>("all");
  const [page, setPage] = useState(() => {
    const fromUrl = Number(searchParams.get("page"));
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : 1;
  });

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedPrices({ minPrice: minPrice.trim(), maxPrice: maxPrice.trim() }),
      300,
    );
    return () => clearTimeout(timeout);
  }, [minPrice, maxPrice]);

  // Changing any filter or the sort invalidates the current page's meaning —
  // but not on the very first render, or this would stomp a page restored
  // from the URL (e.g. ?page=2, or a browser back-navigation) back to 1
  // before the initial fetch even goes out.
  const isFirstFilterRender = useRef(true);
  useEffect(() => {
    if (isFirstFilterRender.current) {
      isFirstFilterRender.current = false;
      return;
    }
    setPage(1);
  }, [
    debouncedSearch,
    categoryId,
    tag,
    debouncedPrices.minPrice,
    debouncedPrices.maxPrice,
    sort,
    availability,
  ]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (page > 1) {
          next.set("page", String(page));
        } else {
          next.delete("page");
        }
        return next;
      },
      { replace: true },
    );
  }, [page, setSearchParams]);

  const { data: categoriesData } = useQuery({
    queryKey: ["storefront", "categories"],
    queryFn: () =>
      axios
        .get<{ categories: StorefrontCategory[] }>("/api/storefront/categories")
        .then((res) => res.data.categories),
  });

  const { data: tagsData } = useQuery({
    queryKey: ["storefront", "tags"],
    queryFn: () =>
      axios.get<{ tags: string[] }>("/api/storefront/tags").then((res) => res.data.tags),
  });

  const { data, isPending, isError } = useQuery({
    queryKey: [
      "storefront",
      "products",
      debouncedSearch,
      categoryId,
      tag,
      debouncedPrices.minPrice,
      debouncedPrices.maxPrice,
      sort,
      availability,
      page,
    ],
    queryFn: () =>
      axios
        .get<{ products: StorefrontProduct[]; total: number }>("/api/storefront/products", {
          params: {
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            ...(categoryId !== ALL_CATEGORIES ? { categoryId } : {}),
            ...(tag !== ALL_TAGS ? { tag } : {}),
            ...(debouncedPrices.minPrice ? { minPrice: debouncedPrices.minPrice } : {}),
            ...(debouncedPrices.maxPrice ? { maxPrice: debouncedPrices.maxPrice } : {}),
            sort,
            ...(availability !== "all" ? { availability } : {}),
            page,
          },
        })
        .then((res) => res.data),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / STOREFRONT_PAGE_SIZE));

  // Derived from the same filter state driving the query above — a pill only
  // ever reflects a filter that's actually been applied (debounced search/
  // price, not every keystroke), matching what the active-filter count and
  // "which filters are set" detection are meant to represent.
  const activeFilters: { key: string; label: string; onRemove: () => void }[] = [];
  if (debouncedSearch) {
    activeFilters.push({
      key: "search",
      label: debouncedSearch,
      onRemove: () => setSearch(""),
    });
  }
  if (tag !== ALL_TAGS) {
    activeFilters.push({ key: "tag", label: tag, onRemove: () => setTag(ALL_TAGS) });
  }
  if (availability !== "all") {
    activeFilters.push({
      key: "availability",
      label: t(AVAILABILITY_LABEL_KEYS[availability]),
      onRemove: () => setAvailability("all"),
    });
  }
  if (debouncedPrices.minPrice || debouncedPrices.maxPrice) {
    const { minPrice: min, maxPrice: max } = debouncedPrices;
    const label =
      min && max
        ? t("products.filters.priceRangeBoth", { min, max })
        : min
          ? t("products.filters.priceRangeMinOnly", { min })
          : t("products.filters.priceRangeMaxOnly", { max });
    activeFilters.push({
      key: "price",
      label,
      onRemove: () => {
        setMinPrice("");
        setMaxPrice("");
      },
    });
  }

  function clearAllFilters() {
    setSearch("");
    setTag(ALL_TAGS);
    setAvailability("all");
    setMinPrice("");
    setMaxPrice("");
  }

  return (
    <div className="relative min-h-screen bg-background font-dm-sans">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden reduced-transparency:hidden"
        style={
          {
            background:
              "radial-gradient(60% 60% at 0% 0%, rgba(34,197,94,0.16) 0%, transparent 60%), radial-gradient(60% 60% at 100% 0%, rgba(255,90,31,0.10) 0%, transparent 60%)",
          } as CSSProperties
        }
      />
      <div className="relative mx-auto max-w-[1340px] space-y-8 px-6 py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold tracking-[0.32em] text-emerald-500 uppercase">
              {t("home.eyebrow")}
            </p>
            <h1 className="mt-2 text-5xl font-black tracking-[-0.035em] text-foreground">
              {t("products.title")}
            </h1>
            <p className="mt-2 max-w-[42ch] text-muted-foreground">{t("products.subtitle")}</p>
          </div>
          <div className="rounded-full border border-foreground/10 bg-card/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none">
            <span className="font-bold text-foreground">{data?.total ?? 0}</span>{" "}
            {t("products.itemCount", { count: data?.total ?? 0 })}
          </div>
        </div>

        <div
          className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label={t("products.filters.category")}
        >
          <button
            type="button"
            onClick={() => setCategoryId(ALL_CATEGORIES)}
            className={cn(CHIP_CLASS, categoryId === ALL_CATEGORIES && CHIP_ACTIVE_CLASS)}
          >
            {t("products.filters.allCategories")}
          </button>
          {(categoriesData ?? []).map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setCategoryId(category.id)}
              className={cn(CHIP_CLASS, categoryId === category.id && CHIP_ACTIVE_CLASS)}
            >
              {localize(category.name, language)}
            </button>
          ))}
        </div>

        <div className="rounded-[20px] border border-foreground/10 bg-card/60 p-4 backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none">
          <div className="grid items-end gap-3 md:grid-cols-2 lg:grid-cols-[minmax(240px,2fr)_minmax(140px,1fr)_minmax(150px,1fr)_minmax(200px,1.3fr)_minmax(150px,1fr)]">
            <div className="flex min-w-0 flex-col md:col-span-2 lg:col-span-1">
              <Label htmlFor="search-filter" className={FIELD_LABEL_CLASS}>
                {t("products.filters.search")}
              </Label>
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 start-4 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="search-filter"
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("products.filters.searchPlaceholder")}
                  aria-label={t("products.filters.search")}
                  className={cn(CONTROL_CLASS, "ps-10", search ? "pe-9" : "")}
                />
                {search && (
                  <button
                    type="button"
                    aria-label={t("products.filters.clearSearch")}
                    onClick={() => setSearch("")}
                    className="absolute top-1/2 end-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-col">
              <Label htmlFor="tag-filter" className={FIELD_LABEL_CLASS}>
                {t("products.filters.tag")}
              </Label>
              <Select value={tag} onValueChange={(value) => setTag(value ?? ALL_TAGS)}>
                <SelectTrigger id="tag-filter" className={SELECT_CONTROL_CLASS}>
                  <SelectValue className={tag !== ALL_TAGS ? "capitalize" : undefined}>
                    {tag === ALL_TAGS ? t("products.filters.allTags") : tag}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TAGS}>{t("products.filters.allTags")}</SelectItem>
                  {(tagsData ?? []).map((tagOption) => (
                    <SelectItem key={tagOption} value={tagOption} className="capitalize">
                      {tagOption}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 flex-col">
              <Label htmlFor="availability-filter" className={FIELD_LABEL_CLASS}>
                {t("products.filters.availability")}
              </Label>
              <Select
                value={availability}
                onValueChange={(value) =>
                  setAvailability((value as StorefrontAvailabilityFilter) ?? "all")
                }
              >
                <SelectTrigger id="availability-filter" className={SELECT_CONTROL_CLASS}>
                  <SelectValue>{t(AVAILABILITY_LABEL_KEYS[availability])}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STOREFRONT_AVAILABILITY_FILTERS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(AVAILABILITY_LABEL_KEYS[option])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 flex-col">
              <Label className={FIELD_LABEL_CLASS}>{t("products.filters.priceRange")}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(event) => setMinPrice(event.target.value)}
                  placeholder={t("products.filters.minPricePlaceholder")}
                  aria-label={t("products.filters.minPrice")}
                  className={cn(CONTROL_CLASS, "min-w-[78px] text-right")}
                />
                <span aria-hidden className="shrink-0 text-muted-foreground">
                  –
                </span>
                <Input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  placeholder={t("products.filters.maxPricePlaceholder")}
                  aria-label={t("products.filters.maxPrice")}
                  className={cn(CONTROL_CLASS, "min-w-[78px] text-right")}
                />
              </div>
            </div>

            <div className="flex min-w-0 flex-col">
              <Label htmlFor="sort-select" className={FIELD_LABEL_CLASS}>
                {t("products.filters.sort")}
              </Label>
              <Select
                value={sort}
                onValueChange={(value) => setSort(value as StorefrontProductSort)}
              >
                <SelectTrigger id="sort-select" className={SELECT_CONTROL_CLASS}>
                  <SelectValue>{t(SORT_LABEL_KEYS[sort])}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STOREFRONT_PRODUCT_SORTS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {t(SORT_LABEL_KEYS[option])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {activeFilters.length > 0 && (
            <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-foreground/10 pt-3.5">
              <span className="text-xs text-muted-foreground">
                {t("products.filters.activeFilters", { count: activeFilters.length })}
              </span>
              {activeFilters.map((filter) => (
                <span key={filter.key} className={FILTER_PILL_CLASS}>
                  <span className="max-w-[220px] truncate" title={filter.label}>
                    {filter.label}
                  </span>
                  <button
                    type="button"
                    aria-label={t("products.filters.removeFilter", { label: filter.label })}
                    onClick={filter.onRemove}
                    className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="ms-auto text-[12.5px] font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                {t("products.filters.clearAll")}
              </button>
            </div>
          )}
        </div>

        {isError ? (
          <p className="py-12 text-center text-sm text-destructive">{t("products.error")}</p>
        ) : isPending ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-5 sm:grid-cols-[repeat(auto-fill,minmax(252px,1fr))]">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-[22px] border border-foreground/10">
                <Skeleton className="aspect-square w-full rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : data.products.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t("products.empty")}</p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-5 sm:grid-cols-[repeat(auto-fill,minmax(252px,1fr))]">
              {data.products.map((product) => {
                const stockStatus = getStockStatus(product);
                const isOnSale = product.salePrice !== null;
                const isNew =
                  Date.now() - new Date(product.createdAt).getTime() < NEW_BADGE_WINDOW_MS;
                const currentPrice = product.salePrice ?? product.price;
                const discountPercent = isOnSale
                  ? Math.round((1 - product.salePrice! / product.price) * 100)
                  : 0;

                const tint =
                  stockStatus === "soldOut"
                    ? "rgba(115,115,115,0.45)"
                    : isOnSale
                      ? "rgba(255,90,31,0.45)"
                      : "rgba(34,197,94,0.45)";

                const badge =
                  stockStatus === "soldOut" ? (
                    <Badge
                      variant="destructive"
                      className="text-[10.5px] font-bold tracking-wide uppercase backdrop-blur"
                    >
                      {t("products.outOfStock")}
                    </Badge>
                  ) : isOnSale ? (
                    <Badge className="border-brand-orange/30 bg-brand-orange/15 text-[10.5px] font-bold tracking-wide text-orange-800 uppercase backdrop-blur dark:text-brand-orange">
                      {t("products.saleBadge", { percent: discountPercent })}
                    </Badge>
                  ) : isNew ? (
                    <Badge className="border-emerald-600/30 bg-emerald-500/15 text-[10.5px] font-bold tracking-wide text-emerald-700 uppercase backdrop-blur dark:border-emerald-500/30 dark:text-emerald-400">
                      {t("products.new")}
                    </Badge>
                  ) : null;

                const productName = localize(product.name, language);
                const productUrl = `/products/${product.id}`;
                const existing = cartItems.find((item) => item.productId === product.id);
                const isPendingAdd = pendingAddIdsRef.current.has(product.id);

                return (
                  <Card
                    key={product.id}
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-[22px] border-foreground/10 bg-gradient-to-b from-card to-card/40 transition-all duration-300 hover:-translate-y-1.5 hover:border-foreground/20 hover:shadow-[0_28px_60px_-28px_rgba(0,0,0,0.4)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:hover:shadow-[0_28px_60px_-28px_rgba(0,0,0,0.95)]",
                    )}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-50 motion-reduce:transition-none"
                      style={
                        {
                          "--tint": tint,
                          background:
                            "radial-gradient(120% 70% at 50% 108%, var(--tint) 0%, transparent 62%)",
                        } as CSSProperties
                      }
                    />
                    {/* bg-white is a deliberate, theme-independent exception (matches the
                        product-image "photo well" convention used elsewhere in this app)
                        so transparent PNG uploads never show a mismatched card color through
                        them, regardless of light/dark mode. */}
                    <div className="relative aspect-square overflow-hidden bg-white">
                      <Link
                        to={productUrl}
                        aria-hidden
                        tabIndex={-1}
                        className="absolute inset-0 block"
                      >
                        {product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt=""
                            className={cn(
                              "size-full object-cover transition-transform duration-500 group-hover:scale-[1.07] motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                              stockStatus === "soldOut" && "grayscale opacity-40",
                            )}
                          />
                        ) : (
                          <div
                            aria-label={t("products.noImage")}
                            className="flex size-full items-center justify-center bg-muted"
                          >
                            <ImageOff className="size-8 text-muted-foreground" />
                          </div>
                        )}
                      </Link>
                      {badge && <div className="absolute start-3 top-3">{badge}</div>}
                      <WishlistButton
                        productId={product.id}
                        className="absolute end-3 top-3 z-10 size-[34px] -translate-y-1 rounded-full border border-foreground/15 bg-background/70 opacity-0 backdrop-blur transition-all group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none reduced-transparency:bg-background reduced-transparency:backdrop-blur-none [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"
                      />
                      {stockStatus === "soldOut" ? (
                        <NotifyMeBar productId={product.id} />
                      ) : (
                        <button
                          type="button"
                          disabled={isPendingAdd}
                          className="absolute inset-x-3 bottom-3 flex h-[42px] translate-y-3 items-center justify-center gap-1.5 rounded-xl bg-foreground/90 text-sm font-bold text-background opacity-0 backdrop-blur transition-all duration-[260ms] group-hover:translate-y-0 group-hover:opacity-100 motion-reduce:transition-none [@media(hover:none)]:translate-y-0 [@media(hover:none)]:opacity-100"
                          onClick={() => {
                            // Synchronous check-and-set on the ref: even a second
                            // click dispatched in the same JS task as the first
                            // sees this write immediately and bails out here.
                            if (pendingAddIdsRef.current.has(product.id)) return;
                            pendingAddIdsRef.current.add(product.id);
                            setPendingAddTick((tick) => tick + 1);
                            setTimeout(() => {
                              pendingAddIdsRef.current.delete(product.id);
                              setPendingAddTick((tick) => tick + 1);
                            }, ADD_TO_CART_GUARD_MS);

                            addItem({
                              productId: product.id,
                              name: product.name,
                              price: currentPrice,
                              imageUrl: product.images[0] ?? null,
                              stock: product.stock,
                              size: product.size,
                              color: product.color,
                            });
                            if (existing) {
                              // Already in the cart — addItem clamps to stock, so
                              // reflect the actual resulting quantity, not a bare
                              // "added" toast that would misleadingly imply a new line.
                              const newQuantity = Math.min(
                                existing.quantity + 1,
                                product.stock,
                              );
                              toast.success(
                                t("cart.updatedToast", { name: productName, quantity: newQuantity }),
                              );
                            } else {
                              toast.success(t("cart.addedToast", { name: productName }));
                            }
                          }}
                        >
                          <ShoppingCart className="size-4" /> {t("cart.addToCart")}
                        </button>
                      )}
                    </div>

                    <div className="relative z-10 flex flex-1 flex-col p-4">
                      <Link to={productUrl} className="contents">
                        <div className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-[0.11em] text-muted-foreground uppercase">
                          <span>{localize(product.category.name, language)}</span>
                          {product.averageRating !== null && (
                            <>
                              <span aria-hidden className="opacity-50">
                                ·
                              </span>
                              <span
                                aria-label={`${t("reviews.averageLabel", {
                                  average: product.averageRating.toFixed(1),
                                })} · ${t("reviews.count", { count: product.reviewCount })}`}
                                className="flex items-center gap-1 text-[11.5px] font-normal tracking-normal text-muted-foreground normal-case"
                              >
                                <Star aria-hidden className="size-3.5 fill-[#facc15] text-[#facc15]" />
                                <span aria-hidden>
                                  {product.averageRating.toFixed(1)} ({product.reviewCount})
                                </span>
                              </span>
                            </>
                          )}
                        </div>
                        <h2 className="mt-2 line-clamp-2 min-h-[2.7em] text-[15.5px] leading-snug font-medium text-foreground">
                          {productName}
                        </h2>
                      </Link>

                      {product.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {product.tags.map((productTag) => (
                            <button
                              key={productTag}
                              type="button"
                              onClick={() => setTag(productTag)}
                              className="rounded-full border border-foreground/10 bg-muted px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              {productTag}
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="mt-auto flex items-end justify-between pt-4">
                        <p className="text-xl font-extrabold tracking-tight text-foreground">
                          <span className="me-1 text-xs font-semibold text-muted-foreground">KSh</span>
                          <span>{currentPrice}</span>
                          {isOnSale && (
                            <span className="ms-2 text-[13px] font-normal text-muted-foreground line-through">
                              {product.price}
                            </span>
                          )}
                        </p>
                        <p
                          className={cn(
                            "flex items-center gap-1.5 text-[11.5px] font-semibold",
                            stockStatus === "soldOut" ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              "size-1.5 rounded-full",
                              stockStatus === "soldOut" ? "bg-muted-foreground/50" : "bg-emerald-500",
                            )}
                            style={
                              stockStatus === "soldOut"
                                ? undefined
                                : { boxShadow: "0 0 0 3px rgba(34,197,94,0.18)" }
                            }
                          />
                          {t(`products.stock.${stockStatus}`)}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page <= 1}
                    className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm text-muted-foreground">
                    {t("products.pagination", { page, totalPages })}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page >= totalPages}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </>
        )}
      </div>
    </div>
  );
}
