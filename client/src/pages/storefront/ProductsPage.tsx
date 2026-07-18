import { useEffect, useState } from "react";
import { Link } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImageOff } from "lucide-react";
import {
  STOREFRONT_PAGE_SIZE,
  STOREFRONT_PRODUCT_SORTS,
  type LocalizedDescription,
  type LocalizedName,
  type StorefrontProductSort,
} from "@es-market/core";
import { localize } from "@/lib/localize";
import { Badge } from "@/components/ui/badge";
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
  imageUrl: string | null;
  category: { id: string; name: LocalizedName };
};

type StorefrontCategory = { id: string; name: LocalizedName };

const ALL_CATEGORIES = "all";

const SORT_LABEL_KEYS: Record<StorefrontProductSort, string> = {
  newest: "products.filters.newest",
  "price-asc": "products.filters.priceAsc",
  "price-desc": "products.filters.priceDesc",
};

export default function ProductsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";

  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [debouncedPrices, setDebouncedPrices] = useState({ minPrice: "", maxPrice: "" });
  const [sort, setSort] = useState<StorefrontProductSort>("newest");
  const [page, setPage] = useState(1);

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
  }, [categoryId, debouncedPrices.minPrice, debouncedPrices.maxPrice, sort]);

  const { data: categoriesData } = useQuery({
    queryKey: ["storefront", "categories"],
    queryFn: () =>
      axios
        .get<{ categories: StorefrontCategory[] }>("/api/storefront/categories")
        .then((res) => res.data.categories),
  });

  const { data, isPending, isError } = useQuery({
    queryKey: [
      "storefront",
      "products",
      categoryId,
      debouncedPrices.minPrice,
      debouncedPrices.maxPrice,
      sort,
      page,
    ],
    queryFn: () =>
      axios
        .get<{ products: StorefrontProduct[]; total: number }>("/api/storefront/products", {
          params: {
            ...(categoryId !== ALL_CATEGORIES ? { categoryId } : {}),
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

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="category-filter">{t("products.filters.category")}</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="category-filter" className="min-w-40">
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
              <Link key={product.id} to={`/products/${product.id}`} className="block">
                <Card className="h-full overflow-hidden py-0 transition-colors hover:border-primary">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={localize(product.name, language)}
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div
                      aria-label={t("products.noImage")}
                      className="flex aspect-square w-full items-center justify-center bg-muted"
                    >
                      <ImageOff className="size-8 text-muted-foreground" />
                    </div>
                  )}
                  <CardContent className="space-y-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-medium">{localize(product.name, language)}</h2>
                      {product.stock === 0 && (
                        <Badge variant="destructive">{t("products.outOfStock")}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {localize(product.category.name, language)}
                    </p>
                    <p className="font-semibold">{product.price}</p>
                  </CardContent>
                </Card>
              </Link>
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
