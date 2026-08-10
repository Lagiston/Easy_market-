import { useEffect, useState, type CSSProperties } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import axios, { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ChevronLeft,
  HandCoins,
  Heart,
  ImageOff,
  Minus,
  Plus,
  ShoppingCart,
  Star,
  Store,
  Truck,
} from "lucide-react";
import { localize } from "@/lib/localize";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";
import ProductReviews from "@/components/storefront/ProductReviews";
import ProductVariantPicker from "@/components/storefront/ProductVariantPicker";
import WishlistButton from "@/components/storefront/WishlistButton";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money, formatCurrencyValue } from "@/components/Money";
import { Skeleton } from "@/components/ui/skeleton";
import type { StorefrontProduct } from "./ProductsPage";

const GLASS_PANEL_CLASS =
  "rounded-[18px] border border-foreground/10 bg-card/60 backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none";

const PERKS = [
  { key: "delivery", Icon: Truck },
  { key: "payOnDelivery", Icon: HandCoins },
  { key: "pickup", Icon: Store },
] as const;

const NEW_BADGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export default function ProductDetailPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
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

  // Reset the chosen quantity and gallery selection whenever the viewed
  // product changes — the component stays mounted when navigating between
  // sibling variants via ProductVariantPicker, so this state would otherwise
  // carry over (and quantity could exceed the new product's stock).
  useEffect(() => {
    setQuantity(1);
    setActiveImage(0);
  }, [product?.id]);

  const notFound = isAxiosError(error) && error.response?.status === 404;
  // Whether to render the interactive size/color picker instead of the plain
  // related-products grid — true only when at least one member of the group
  // (this product or a sibling) actually has a size/color label set.
  const hasVariantLabels = product
    ? [product, ...product.relatedProducts].some((p) => p.size || p.color)
    : false;

  return (
    <div className="relative min-h-screen bg-background font-dm-sans">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 overflow-hidden reduced-transparency:hidden"
        style={
          {
            background:
              "radial-gradient(60% 60% at 0% 0%, rgba(34,197,94,0.15) 0%, transparent 60%), radial-gradient(60% 60% at 100% 0%, rgba(255,90,31,0.09) 0%, transparent 60%)",
          } as CSSProperties
        }
      />
      <div className="relative mx-auto max-w-[1240px] space-y-8 px-6 py-8 pb-24">
        <button
          type="button"
          // Goes back in history (preserving the products list's page/filters,
          // which live in its own URL/state, not this page's) rather than
          // always landing on a bare /products — but only when there's actual
          // in-app history to return to: `location.key === "default"` means
          // this is the first entry (a fresh load/shared link), where a real
          // back navigation would leave the app entirely.
          onClick={() => (location.key === "default" ? navigate("/products") : navigate(-1))}
          className="inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card/60 px-4 py-2 text-sm text-muted-foreground backdrop-blur-xl transition-colors hover:border-foreground/20 hover:text-foreground reduced-transparency:bg-card reduced-transparency:backdrop-blur-none"
        >
          <ChevronLeft className="size-4 rtl:rotate-180" />
          {t("products.backToList")}
        </button>

        {isPending ? (
          <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-2">
            <Skeleton className="aspect-square w-full rounded-3xl" />
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
          <ProductDetailContent
            product={product}
            language={language}
            activeImage={activeImage}
            setActiveImage={setActiveImage}
            quantity={quantity}
            setQuantity={setQuantity}
            addItem={addItem}
            navigate={navigate}
          />
        )}

        {!isPending &&
          !notFound &&
          !error &&
          product.relatedProducts.length > 0 &&
          !hasVariantLabels && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {t("products.relatedTitle")}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {product.relatedProducts.map((related) => (
                  <Link
                    key={related.id}
                    to={`/products/${related.id}`}
                    className={cn(
                      GLASS_PANEL_CLASS,
                      "block overflow-hidden rounded-2xl transition-colors hover:border-foreground/20",
                    )}
                  >
                    {related.images[0] ? (
                      <img
                        src={related.images[0]}
                        alt={localize(related.name, language)}
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
                    <div className="space-y-1 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {localize(related.name, language)}
                        </p>
                        {related.stock === 0 && (
                          <Badge variant="destructive">{t("products.outOfStock")}</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-foreground">
                          <Money amount={related.price} />
                        </p>
                        {related.averageRating !== null && (
                          <p
                            aria-label={`${t("reviews.averageLabel", {
                              average: related.averageRating.toFixed(1),
                            })} · ${t("reviews.count", { count: related.reviewCount })}`}
                            className="flex items-center gap-1 text-sm text-muted-foreground"
                          >
                            <Star aria-hidden className="size-3.5 fill-emerald-500 text-emerald-500" />
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

        {!isPending && !notFound && !error && (
          <div className="mt-18 border-t border-foreground/10 pt-11" id="reviews">
            <ProductReviews productId={product.id} />
          </div>
        )}
      </div>
    </div>
  );
}

function ProductDetailContent({
  product,
  language,
  activeImage,
  setActiveImage,
  quantity,
  setQuantity,
  addItem,
  navigate,
}: {
  product: StorefrontProduct & { relatedProducts: StorefrontProduct[] };
  language: string;
  activeImage: number;
  setActiveImage: (index: number) => void;
  quantity: number;
  setQuantity: (updater: (q: number) => number) => void;
  addItem: ReturnType<typeof useCart>["addItem"];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { t } = useTranslation();
  const productName = localize(product.name, language);
  const stockStatus =
    product.stock === 0 ? "soldOut" : product.stock < product.lowStockThreshold ? "lowStock" : "inStock";
  const isOnSale = product.salePrice !== null;
  const currentPrice = product.salePrice ?? product.price;
  const discountPercent = isOnSale
    ? Math.round((1 - product.salePrice! / product.price) * 100)
    : 0;
  const isNew = Date.now() - new Date(product.createdAt).getTime() < NEW_BADGE_WINDOW_MS;
  // Same badge derivation/priority as the product-card grid (ProductsPage) —
  // reused here rather than a fabricated "best seller" flag, since there's no
  // real sales-count data anywhere in this codebase to back one.
  const galleryBadge =
    stockStatus === "soldOut" ? (
      <Badge variant="destructive" className="text-[11px] font-bold tracking-wide uppercase backdrop-blur">
        {t("products.outOfStock")}
      </Badge>
    ) : isOnSale ? (
      <Badge className="border-brand-orange/30 bg-brand-orange/15 text-[11px] font-bold tracking-wide text-orange-800 uppercase backdrop-blur dark:text-brand-orange">
        {t("products.saleBadge", { percent: discountPercent })}
      </Badge>
    ) : isNew ? (
      <Badge className="border-emerald-600/30 bg-emerald-500/15 text-[11px] font-bold tracking-wide text-emerald-700 uppercase backdrop-blur dark:border-emerald-500/30 dark:text-emerald-400">
        {t("products.new")}
      </Badge>
    ) : null;

  return (
    <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-2">
      <div className="space-y-2.5 lg:sticky lg:top-6">
        <div
          className="relative aspect-square overflow-hidden rounded-3xl border border-foreground/10"
          style={{ background: "radial-gradient(80% 70% at 50% 28%, #242a26, #12150f 78%)" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 60% at 50% 112%, rgba(34,197,94,0.30), transparent 62%)",
            }}
          />
          {product.images[activeImage] ? (
            <img
              src={product.images[activeImage]}
              alt={productName}
              className="relative size-full bg-white object-cover"
            />
          ) : (
            <div
              aria-label={t("products.noImage")}
              className="relative flex size-full items-center justify-center bg-white"
            >
              <ImageOff className="size-10 text-muted-foreground" />
            </div>
          )}
          {galleryBadge && <div className="absolute start-4 top-4">{galleryBadge}</div>}
        </div>
        {product.images.length > 1 && (
          <div className="grid grid-cols-4 gap-2.5">
            {product.images.map((imageUrl, index) => (
              <button
                key={imageUrl}
                type="button"
                onClick={() => setActiveImage(index)}
                aria-label={`${productName} ${index + 1}`}
                aria-current={index === activeImage}
                className={cn(
                  "aspect-square overflow-hidden rounded-2xl border bg-white transition-all",
                  index === activeImage
                    ? "border-emerald-500 ring-4 ring-emerald-500/[0.16]"
                    : "border-foreground/10 hover:border-foreground/20",
                )}
              >
                <img src={imageUrl} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5">
        <div>
          <p className="text-[11px] font-bold tracking-[0.14em] text-emerald-500 uppercase">
            {localize(product.category.name, language)}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] leading-tight text-foreground">
            {productName}
          </h1>
          {product.averageRating !== null && (
            <p
              aria-label={`${t("reviews.averageLabel", {
                average: product.averageRating.toFixed(1),
              })} · ${t("reviews.count", { count: product.reviewCount })}`}
              className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <span className="inline-flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    aria-hidden
                    className={cn(
                      "size-4",
                      star <= Math.round(product.averageRating!)
                        ? "fill-[#facc15] text-[#facc15]"
                        : "text-muted-foreground/40",
                    )}
                  />
                ))}
              </span>
              <span aria-hidden>{product.averageRating.toFixed(1)}</span>
              <a href="#reviews" className="underline underline-offset-4 hover:text-foreground">
                {t("reviews.count", { count: product.reviewCount })}
              </a>
            </p>
          )}
          {product.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.tags.map((tag) => (
                <Link
                  key={tag}
                  to={`/products?tag=${encodeURIComponent(tag)}`}
                  className="rounded-full border border-foreground/10 bg-muted px-3 py-1 text-[11.5px] text-muted-foreground hover:text-foreground"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>

        {product.description && (
          <p className="max-w-[46ch] text-[15px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {localize(product.description, language)}
          </p>
        )}

        <Card className={cn(GLASS_PANEL_CLASS, "space-y-4 rounded-[18px] p-5")}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-4xl font-black tracking-[-0.035em] text-foreground">
              <Money amount={currentPrice} />
              {isOnSale && (
                <span className="ms-2 text-base font-normal text-muted-foreground line-through">
                  {formatCurrencyValue(product.price)}
                </span>
              )}
              {isOnSale && (
                <Badge className="ms-2 border-brand-orange/30 bg-brand-orange/15 align-middle text-[11px] font-bold text-orange-800 dark:text-brand-orange">
                  {t("products.saleBadge", { percent: discountPercent })}
                </Badge>
              )}
            </p>
          </div>

          {stockStatus === "soldOut" ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <span aria-hidden className="size-2 rounded-full bg-muted-foreground/40" />
              {t("products.outOfStock")}
            </p>
          ) : stockStatus === "lowStock" ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-orange-700 dark:text-brand-orange">
              <span aria-hidden className="size-2 rounded-full bg-brand-orange" />
              {t("products.lowStock", { count: product.stock })}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <span
                aria-hidden
                className="size-2 rounded-full bg-emerald-500"
                style={{ boxShadow: "0 0 0 3px rgba(34,197,94,0.18)" }}
              />
              {t("products.inStockReady")}
            </p>
          )}

          {product.wishlistCount > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Heart aria-hidden className="size-3.5 fill-emerald-500 text-emerald-500" />
              {t("products.wishlistCount", { count: product.wishlistCount })}
            </p>
          )}

          {hasVariantLabelsFor(product) && (
            <div className="border-t border-foreground/10 pt-4">
              <ProductVariantPicker product={product} relatedProducts={product.relatedProducts} />
            </div>
          )}

          <div className="flex flex-wrap items-stretch gap-2.5">
            {product.stock > 0 && (
              <div className="flex h-[50px] items-center gap-1 rounded-[13px] border border-foreground/10 bg-card/60 px-1.5 backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none">
                <button
                  type="button"
                  aria-label={t("cart.decrease", { name: productName })}
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums text-foreground">
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label={t("cart.increase", { name: productName })}
                  disabled={quantity >= product.stock}
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  className="flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-40"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            )}
            <button
              type="button"
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
                toast.success(t("cart.addedToast", { name: productName }));
              }}
              className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-[13px] bg-emerald-500 font-bold text-[#07130c] transition-all hover:bg-emerald-400 hover:shadow-[0_12px_30px_-12px_rgba(34,197,94,0.6)] disabled:pointer-events-none disabled:opacity-50"
            >
              <ShoppingCart className="size-4" />
              {t("cart.addToCart")}
            </button>
            <button
              type="button"
              disabled={product.stock === 0}
              onClick={() => {
                toast.success(t("cart.buyNowToast", { name: productName }));
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
              className="flex h-[50px] items-center justify-center rounded-[13px] border border-foreground/10 bg-card/60 px-5 font-bold text-foreground backdrop-blur-xl transition-colors hover:border-foreground/20 disabled:pointer-events-none disabled:opacity-50 reduced-transparency:bg-card reduced-transparency:backdrop-blur-none"
            >
              {t("products.buyNow")}
            </button>
            <WishlistButton
              productId={product.id}
              className="h-[50px] w-[50px] rounded-[13px] border-foreground/10 bg-card/60 backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none"
            />
          </div>
        </Card>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
          {PERKS.map(({ key, Icon }) => (
            <div
              key={key}
              className={cn(GLASS_PANEL_CLASS, "flex items-start gap-2.5 rounded-2xl p-3.5")}
            >
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <div>
                <p className="text-[13px] font-bold text-foreground">
                  {t(`products.perks.${key}.title`)}
                </p>
                <p className="text-xs text-muted-foreground">{t(`products.perks.${key}.text`)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function hasVariantLabelsFor(product: StorefrontProduct & { relatedProducts: StorefrontProduct[] }) {
  return [product, ...product.relatedProducts].some((p) => p.size || p.color);
}
