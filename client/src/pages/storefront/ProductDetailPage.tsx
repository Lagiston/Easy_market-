import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import axios, { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Heart, ImageOff, Minus, Plus, ShoppingCart, Star } from "lucide-react";
import { localize } from "@/lib/localize";
import { useCart } from "@/lib/cart";
import ProductReviews from "@/components/storefront/ProductReviews";
import ProductVariantPicker from "@/components/storefront/ProductVariantPicker";
import WishlistButton from "@/components/storefront/WishlistButton";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StorefrontProduct } from "./ProductsPage";

export default function ProductDetailPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  // Merges relatedProducts onto the product object (rather than keeping the
  // envelope's two top-level fields separate) so `product` stays the direct
  // useQuery `data` alias below — that's what lets the isPending/notFound/
  // error ternary narrow `product` to defined in the success branch.
  const { data: product, isPending, error } = useQuery({
    queryKey: ["storefront", "product", id],
    queryFn: () =>
      axios
        .get<{ product: StorefrontProduct; relatedProducts: StorefrontProduct[] }>(
          `/api/storefront/products/${id}`,
        )
        .then((res) => ({ ...res.data.product, relatedProducts: res.data.relatedProducts ?? [] })),
  });

  // Reset the chosen quantity whenever the viewed product changes — the
  // component stays mounted when navigating between sibling variants via
  // ProductVariantPicker, so `quantity` would otherwise carry over (and
  // could exceed the new product's stock).
  useEffect(() => setQuantity(1), [product?.id]);

  const notFound = isAxiosError(error) && error.response?.status === 404;
  // Whether to render the interactive size/color picker instead of the plain
  // related-products grid — true only when at least one member of the group
  // (this product or a sibling) actually has a size/color label set.
  const hasVariantLabels = product
    ? [product, ...product.relatedProducts].some((p) => p.size || p.color)
    : false;

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
          <div className="space-y-2">
            {product.images[activeImage] ? (
              <img
                src={product.images[activeImage]}
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
            {product.images.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {product.images.map((imageUrl, index) => (
                  <button
                    key={imageUrl}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`${localize(product.name, language)} ${index + 1}`}
                    aria-current={index === activeImage}
                    className={`size-16 shrink-0 overflow-hidden rounded-md border ${
                      index === activeImage ? "border-primary ring-1 ring-primary" : ""
                    }`}
                  >
                    <img src={imageUrl} alt="" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold">{localize(product.name, language)}</h1>
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
              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {product.tags.map((tag) => (
                    <Link
                      key={tag}
                      to={`/products?tag=${encodeURIComponent(tag)}`}
                      className={`${badgeVariants({ variant: "secondary" })} hover:bg-secondary/80`}
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <p className="text-xl font-semibold">{product.price}</p>
              {product.stock === 0 && (
                <Badge variant="destructive">{t("products.outOfStock")}</Badge>
              )}
            </div>
            {product.wishlistCount > 0 && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Heart aria-hidden className="size-3.5 fill-primary text-primary" />
                {t("products.wishlistCount", { count: product.wishlistCount })}
              </p>
            )}
            {product.description && (
              <p className="text-sm whitespace-pre-wrap">
                {localize(product.description, language)}
              </p>
            )}
            <div className="flex items-center gap-2">
              {product.stock > 0 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label={t("cart.decrease", { name: localize(product.name, language) })}
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  >
                    <Minus />
                  </Button>
                  <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    aria-label={t("cart.increase", { name: localize(product.name, language) })}
                    disabled={quantity >= product.stock}
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  >
                    <Plus />
                  </Button>
                </div>
              )}
              <Button
                disabled={product.stock === 0}
                onClick={() => {
                  addItem(
                    {
                      productId: product.id,
                      name: product.name,
                      price: product.price,
                      imageUrl: product.images[0] ?? null,
                      stock: product.stock,
                      size: product.size,
                      color: product.color,
                    },
                    quantity,
                  );
                  toast.success(t("cart.addedToast", { name: localize(product.name, language) }));
                }}
              >
                <ShoppingCart />
                {t("cart.addToCart")}
              </Button>
              <Button
                variant="outline"
                disabled={product.stock === 0}
                onClick={() => {
                  toast.success(t("cart.buyNowToast", { name: localize(product.name, language) }));
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
                        quantity,
                      },
                    },
                  });
                }}
              >
                {t("products.buyNow")}
              </Button>
              <WishlistButton productId={product.id} />
            </div>
          </div>
        </div>
      )}
      {!isPending && !notFound && !error && product.relatedProducts.length > 0 && hasVariantLabels && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("products.variants.chooseOptions")}</h2>
          <ProductVariantPicker product={product} relatedProducts={product.relatedProducts} />
        </div>
      )}
      {!isPending && !notFound && !error && product.relatedProducts.length > 0 && !hasVariantLabels && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("products.relatedTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {product.relatedProducts.map((related) => (
              <Link
                key={related.id}
                to={`/products/${related.id}`}
                className="block overflow-hidden rounded-md border transition-colors hover:border-primary"
              >
                {related.images[0] ? (
                  <img
                    src={related.images[0]}
                    alt={localize(related.name, language)}
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
                <div className="space-y-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{localize(related.name, language)}</p>
                    {related.stock === 0 && (
                      <Badge variant="destructive">{t("products.outOfStock")}</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{related.price}</p>
                    {related.averageRating !== null && (
                      <p
                        aria-label={`${t("reviews.averageLabel", {
                          average: related.averageRating.toFixed(1),
                        })} · ${t("reviews.count", { count: related.reviewCount })}`}
                        className="flex items-center gap-1 text-sm text-muted-foreground"
                      >
                        <Star aria-hidden className="size-3.5 fill-primary text-primary" />
                        <span aria-hidden>
                          {related.averageRating.toFixed(1)} ({related.reviewCount})
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
      {!isPending && !notFound && !error && <ProductReviews productId={product.id} />}
    </div>
  );
}
