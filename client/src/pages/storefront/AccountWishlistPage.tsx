import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ImageOff, ShoppingCart, Trash2, Zap } from "lucide-react";
import { localize } from "@/lib/localize";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountWishlistPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const { products, isPending, isError, removeMutation } = useWishlist();
  const { addItem } = useCart();
  const navigate = useNavigate();

  const backInStockCount = products.filter((product) => product.backInStock).length;
  const priceDroppedCount = products.filter((product) => product.priceDropped).length;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("account.wishlist.title")}</h1>

      {backInStockCount > 0 && (
        <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          {t("account.wishlist.backInStockBanner", { count: backInStockCount })}
        </p>
      )}
      {priceDroppedCount > 0 && (
        <p className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm text-primary">
          {t("account.wishlist.priceDropBanner", { count: priceDroppedCount })}
        </p>
      )}

      {isError ? (
        <p className="py-12 text-center text-sm text-destructive">{t("account.wishlist.error")}</p>
      ) : isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("account.wishlist.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const name = localize(product.name, language);
            return (
              <Card key={product.id} className="py-0">
                <CardContent className="flex items-center gap-4 p-4">
                  {product.images[0] ? (
                    <img
                      src={product.images[0]}
                      alt={name}
                      className="size-16 shrink-0 rounded-md border object-cover"
                    />
                  ) : (
                    <div
                      aria-label={t("products.noImage")}
                      className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted"
                    >
                      <ImageOff className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <Link
                      to={`/products/${product.id}`}
                      className="block truncate font-medium hover:text-primary"
                    >
                      {name}
                    </Link>
                    {(product.size || product.color) && (
                      <p className="text-xs text-muted-foreground">
                        {[product.size, product.color].filter(Boolean).join(" / ")}
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      {product.priceDropped ? (
                        <p className="text-sm">
                          <span className="text-muted-foreground line-through">
                            {product.priceAtSave}
                          </span>{" "}
                          <span className="font-medium text-primary">{product.price}</span>
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">{product.price}</p>
                      )}
                      {product.stock === 0 ? (
                        <Badge variant="destructive">{t("products.outOfStock")}</Badge>
                      ) : (
                        product.backInStock && (
                          <Badge variant="secondary" className="text-primary">
                            {t("account.wishlist.backInStock")}
                          </Badge>
                        )
                      )}
                      {product.priceDropped && (
                        <Badge variant="secondary" className="text-primary">
                          {t("account.wishlist.priceDrop")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={product.stock === 0}
                    aria-label={t("cart.addToCart")}
                    onClick={() => {
                      addItem({
                        productId: product.id,
                        name: product.name,
                        price: product.price,
                        imageUrl: product.images[0] ?? null,
                        stock: product.stock,
                        size: product.size,
                        color: product.color,
                      });
                      toast.success(t("cart.addedToast", { name }));
                    }}
                  >
                    <ShoppingCart />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-8"
                    disabled={product.stock === 0}
                    aria-label={t("products.buyNow")}
                    onClick={() => {
                      toast.success(t("cart.buyNowToast", { name }));
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
                    <Zap />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label={t("account.wishlist.remove", { name })}
                    onClick={() => removeMutation.mutate(product.id)}
                  >
                    <Trash2 />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
