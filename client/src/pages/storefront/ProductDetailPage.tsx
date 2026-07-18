import { Link, useParams } from "react-router";
import axios, { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ImageOff, ShoppingCart } from "lucide-react";
import { localize } from "@/lib/localize";
import { useCart } from "@/lib/cart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StorefrontProduct } from "./ProductsPage";

export default function ProductDetailPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const { id } = useParams<{ id: string }>();
  const { addItem } = useCart();

  const { data: product, isPending, error } = useQuery({
    queryKey: ["storefront", "product", id],
    queryFn: () =>
      axios
        .get<{ product: StorefrontProduct }>(`/api/storefront/products/${id}`)
        .then((res) => res.data.product),
  });

  const notFound = isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("products.backToList")}
      </Link>

      {isPending ? (
        <div className="grid gap-8 sm:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-md" />
          <div className="space-y-3">
            <Skeleton className="h-7 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ) : notFound ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("products.notFound")}
        </p>
      ) : error ? (
        <p className="py-12 text-center text-sm text-destructive">{t("products.error")}</p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={localize(product.name, language)}
              className="aspect-square w-full rounded-md border object-cover"
            />
          ) : (
            <div
              aria-label={t("products.noImage")}
              className="flex aspect-square w-full items-center justify-center rounded-md border bg-muted"
            >
              <ImageOff className="size-10 text-muted-foreground" />
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">{localize(product.name, language)}</h1>
              <p className="text-sm text-muted-foreground">
                {localize(product.category.name, language)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xl font-semibold">{product.price}</p>
              {product.stock === 0 && (
                <Badge variant="destructive">{t("products.outOfStock")}</Badge>
              )}
            </div>
            {product.description && (
              <p className="text-sm whitespace-pre-wrap">
                {localize(product.description, language)}
              </p>
            )}
            <Button
              disabled={product.stock === 0}
              onClick={() =>
                addItem({
                  productId: product.id,
                  name: product.name,
                  price: product.price,
                  imageUrl: product.imageUrl,
                  stock: product.stock,
                })
              }
            >
              <ShoppingCart />
              {t("cart.addToCart")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
