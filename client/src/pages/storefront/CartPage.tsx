import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ImageOff, Minus, Plus, Trash2 } from "lucide-react";
import { localize } from "@/lib/localize";
import { useCart } from "@/lib/cart";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function CartPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("cart.title")}</h1>

      {items.length === 0 ? (
        <div className="space-y-4 py-12 text-center">
          <p className="text-sm text-muted-foreground">{t("cart.empty")}</p>
          <Link to="/products" className={buttonVariants({ variant: "outline" })}>
            {t("cart.browseProducts")}
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => {
              const name = localize(item.name, language);
              return (
                <Card key={item.productId} className="py-0">
                  <CardContent className="flex items-center gap-4 p-4">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={name}
                        className="size-16 shrink-0 rounded-md border bg-white object-cover"
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
                        to={`/products/${item.productId}`}
                        className="block truncate font-medium hover:text-primary"
                      >
                        {name}
                      </Link>
                      {(item.size || item.color) && (
                        <p className="text-xs text-muted-foreground">
                          {[item.size, item.color].filter(Boolean).join(" / ")}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">{item.price}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={t("cart.decrease", { name })}
                        disabled={item.quantity <= 1}
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      >
                        <Minus />
                      </Button>
                      <span className="w-8 text-center text-sm tabular-nums">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={t("cart.increase", { name })}
                        disabled={item.quantity >= item.stock}
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                    <p className="w-16 text-end font-semibold tabular-nums">
                      {item.price * item.quantity}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      aria-label={t("cart.remove", { name })}
                      onClick={() => removeItem(item.productId)}
                    >
                      <Trash2 />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <p className="text-sm text-muted-foreground">{t("cart.subtotal")}</p>
            <p className="text-xl font-semibold tabular-nums">{subtotal}</p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Link to="/products" className={buttonVariants({ variant: "outline" })}>
              {t("cart.browseProducts")}
            </Link>
            <Link to="/checkout" className={buttonVariants({})}>
              {t("cart.checkout")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
