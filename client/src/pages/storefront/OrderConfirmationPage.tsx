import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { CircleCheck } from "lucide-react";
import { FulfillmentType } from "@es-market/core";
import { localize } from "@/lib/localize";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PlacedOrder } from "./CheckoutPage";

export default function OrderConfirmationPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const navigate = useNavigate();
  const location = useLocation();
  const order = (location.state as { order?: PlacedOrder } | null)?.order;

  // Only reachable right after placing an order — a direct visit has no order.
  useEffect(() => {
    if (!order) navigate("/", { replace: true });
  }, [order, navigate]);

  if (!order) return null;

  return (
    <div className="mx-auto max-w-xl space-y-6 text-center">
      <CircleCheck className="mx-auto size-12 text-primary" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("confirmation.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {order.fulfillmentType === FulfillmentType.PICKUP
            ? t("confirmation.pickupNote")
            : t("confirmation.callNote")}
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t("confirmation.yourCode")}</p>
        <p className="text-3xl font-semibold tracking-widest">{order.code}</p>
        <p className="text-sm text-muted-foreground">{t("confirmation.keepCode")}</p>
        <Link to="/track" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("confirmation.trackOrder")}
        </Link>
      </div>

      <Card className="py-0 text-start">
        <CardContent className="space-y-3 p-4">
          <ul className="space-y-2">
            {order.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {localize(item.productName, language)} × {item.quantity}
                </span>
                <span className="tabular-nums">{item.unitPrice * item.quantity}</span>
              </li>
            ))}
          </ul>
          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("cart.subtotal")}</span>
              <span className="tabular-nums">{order.subtotal}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("checkout.deliveryFee")}</span>
              <span className="tabular-nums">
                {order.deliveryFee === 0 ? t("checkout.free") : order.deliveryFee}
              </span>
            </div>
            <div className="flex justify-between pt-1 text-base font-semibold">
              <span>{t("checkout.total")}</span>
              <span className="tabular-nums">{order.total}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Link to="/products" className={buttonVariants({})}>
        {t("confirmation.continueShopping")}
      </Link>
    </div>
  );
}
