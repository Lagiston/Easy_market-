import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImageOff, Search, ShoppingCart, Star, X } from "lucide-react";
import {
  STOREFRONT_PAGE_SIZE,
  STOREFRONT_PRODUCT_SORTS,
  type LocalizedDescription,
  type LocalizedName,
  type StorefrontProductSort,
} from "@es-market/core";
import { localize } from "@/lib/localize";
import { useCart } from "@/lib/cart";
import WishlistButton from "@/components/storefront/WishlistButton";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export type StorefrontProduct = {
  id: string;
  name: LocalizedName;
  description: LocalizedDescription | null;
  price: number;
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
};

type StorefrontCategory = { id: string; name: LocalizedName };

const ALL_CATEGORIES = "all";
const ALL_TAGS = "all";

const SORT_LABEL_KEYS: Record<StorefrontProductSort, string> = {
  newest: "products.filters.newest",
  "price-asc": "products.filters.priceAsc",
  "price-desc": "products.filters.priceDesc",
};

// A rapid double-click can fire both click handlers before React commits a
// state update — even a `useState` guard checked in the same synchronous
// event-dispatch stack still reads the pre-update value for the second
// click, so both handlers see the same stale `cartItems` and each shows its
// own toast. This window disables the button per-product just long enough
// for a real re-render to land, collapsing an accidental double-click into
// one add and one toast.
const ADD_TO_CART_GUARD_MS = 400;

export default function ProductsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const navigate = useNavigate();
  const { items: cartItems, addItem } = useCart();
  // Source of truth for the guard is a ref, not state: a ref mutates
  // synchronously, so even two clicks dispatched within the same JS task
  // (a genuinely instant double-click) see each other's write immediately.
  // `pendingAddTick` exists only to trigger the re-render that reflects the
  // ref's current contents in the button's `disabled` prop.
  const pendingAddIdsRef = useRef<Set<string>>(new Set());
  const [, setPendingAddTick] = useState(0);

  // Read-once, not two-way synced: lets a link (e.g. a tag chip on the product
  // detail page) land here pre-filtered, without making every filter change
  // round-trip through the URL.
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [tag, setTag] = useState(() => searchParams.get("tag") ?? ALL_TAGS);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [debouncedPrices, setDebouncedPrices] = useState({ minPrice: "", maxPrice: "" });
  const [sort, setSort] = useState<StorefrontProductSort>("newest");
  const [page, setPage] = useState(1);

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

  // Changing any filter or the sort invalidates the current page's meaning.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, tag, debouncedPrices.minPrice, debouncedPrices.maxPrice, sort]);

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
            page,
          },
        })
        .then((res) => res.data),
  });

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / STOREFRONT_PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("products.title")}</h1>

      <div className="relative max-w-sm">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 start-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("products.filters.searchPlaceholder")}
          aria-label={t("products.filters.search")}
          className={search ? "ps-9 pe-9" : "ps-9"}
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

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category-filter">{t("products.filters.category")}</Label>
          <Select
            value={categoryId}
            onValueChange={(value) => setCategoryId(value ?? ALL_CATEGORIES)}
          >
            <SelectTrigger id="category-filter" className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>
                {t("products.filters.allCategories")}
              </SelectItem>
              {(categoriesData ?? []).map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {localize(category.name, language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tag-filter">{t("products.filters.tag")}</Label>
          <Select value={tag} onValueChange={(value) => setTag(value ?? ALL_TAGS)}>
            <SelectTrigger id="tag-filter" className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TAGS}>{t("products.filters.allTags")}</SelectItem>
              {(tagsData ?? []).map((tagOption) => (
                <SelectItem key={tagOption} value={tagOption}>
                  {tagOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="min-price">{t("products.filters.minPrice")}</Label>
          <Input
            id="min-price"
            type="number"
            min={0}
            value={minPrice}
            onChange={(event) => setMinPrice(event.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="max-price">{t("products.filters.maxPrice")}</Label>
          <Input
            id="max-price"
            type="number"
            min={0}
            value={maxPrice}
            onChange={(event) => setMaxPrice(event.target.value)}
            className="w-28"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sort-select">{t("products.filters.sort")}</Label>
          <Select
            value={sort}
            onValueChange={(value) => setSort(value as StorefrontProductSort)}
          >
            <SelectTrigger id="sort-select" className="min-w-44">
              <SelectValue />
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

      {isError ? (
        <p className="py-12 text-center text-sm text-destructive">{t("products.error")}</p>
      ) : isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Card key={i} className="overflow-hidden py-0">
              <Skeleton className="aspect-square w-full rounded-none" />
              <CardContent className="space-y-2 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data.products.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("products.empty")}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.products.map((product) => (
              <Card
                key={product.id}
                className="relative h-full overflow-hidden py-0 transition-colors hover:border-primary"
              >
                {/* Link comes first in DOM order (though visually the heart
                    overlays its top-right corner via absolute positioning)
                    so a keyboard user reaches the card's primary content —
                    the product image/title — before the secondary wishlist
                    toggle. */}
                <Link to={`/products/${product.id}`} className="block">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={localize(product.name, language)}
                      className="aspect-square w-full bg-white object-cover"
                    />
                  ) : (
                    <div
                      aria-label={t("products.noImage")}
                      className="flex aspect-square w-full items-center justify-center bg-muted"
                    >
                      <ImageOff className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="space-y-1 p-4 pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-medium">{localize(product.name, language)}</h2>
                      {product.stock === 0 && (
                        <Badge variant="destructive">{t("products.outOfStock")}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {localize(product.category.name, language)}
                    </p>
                    {product.averageRating !== null && (
                      <p
                        aria-label={`${t("reviews.averageLabel", {
                          average: product.averageRating.toFixed(1),
                        })} · ${t("reviews.count", { count: product.reviewCount })}`}
                        className="flex items-center gap-1 text-sm text-muted-foreground"
                      >
                        <Star aria-hidden className="size-3.5 fill-primary text-primary" />
                        <span aria-hidden>
                          {product.averageRating.toFixed(1)} ({product.reviewCount})
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Link>
                <WishlistButton
                  productId={product.id}
                  className="absolute end-2 top-2 z-10 size-8 bg-background/80 backdrop-blur-sm hover:bg-background"
                />
                <CardContent className="space-y-1 p-4 pt-1">
                  {product.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {product.tags.map((productTag) => (
                        <button
                          key={productTag}
                          type="button"
                          onClick={() => setTag(productTag)}
                          className={`${badgeVariants({ variant: "secondary" })} hover:bg-secondary/80`}
                        >
                          {productTag}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="font-semibold">{product.price}</p>
                  <div className="flex gap-2">
                    <Button
                      className="min-w-0 flex-1"
                      disabled={product.stock === 0 || pendingAddIdsRef.current.has(product.id)}
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

                        const existing = cartItems.find(
                          (item) => item.productId === product.id,
                        );
                        addItem({
                          productId: product.id,
                          name: product.name,
                          price: product.price,
                          imageUrl: product.images[0] ?? null,
                          stock: product.stock,
                          size: product.size,
                          color: product.color,
                        });
                        const name = localize(product.name, language);
                        if (existing) {
                          // Already in the cart — addItem clamps to stock, so
                          // reflect the actual resulting quantity, not a bare
                          // "added" toast that would misleadingly imply a new line.
                          const newQuantity = Math.min(existing.quantity + 1, product.stock);
                          toast.success(t("cart.updatedToast", { name, quantity: newQuantity }));
                        } else {
                          toast.success(t("cart.addedToast", { name }));
                        }
                      }}
                    >
                      <ShoppingCart /> {t("cart.addToCart")}
                    </Button>
                    <Button
                      variant="outline"
                      className="min-w-0 flex-1"
                      disabled={product.stock === 0}
                      onClick={() => {
                        toast.success(
                          t("cart.buyNowToast", { name: localize(product.name, language) }),
                        );
                        navigate("/checkout", {
                          state: {
                            buyNowItem: {
                              productId: product.id,
                              name: product.name,
                              price: product.price,
                              imageUrl: product.images[0] ?? null,
                              stock: product.stock,
                              size: product.size,
                              color: product.color,
                              quantity: 1,
                            },
                          },
                        });
                      }}
                    >
                      {t("products.buyNow")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
  );
}
