import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ImageOff, Trash2 } from "lucide-react";
import { localize } from "@/lib/localize";
import { useWishlist } from "@/lib/wishlist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountWishlistPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const { products, isPending, isError, removeMutation } = useWishlist();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("account.wishlist.title")}</h1>

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
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground">{product.price}</p>
                      {product.stock === 0 && (
                        <Badge variant="destructive">{t("products.outOfStock")}</Badge>
                      )}
                    </div>
                  </div>
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
