import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  orderLookupSchema,
  OrderStatus,
  type OrderLookupFormInput,
} from "@es-market/core";
import { localize } from "@/lib/localize";
import { translateFieldError } from "@/lib/zod-error-i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlacedOrder } from "./CheckoutPage";

type LookupOrder = PlacedOrder & { createdAt: string };

const STATUS_KEYS: Record<OrderStatus, string> = {
  RECEIVED: "orderStatus.statuses.received",
  CONFIRMED: "orderStatus.statuses.confirmed",
  OUT_FOR_DELIVERY: "orderStatus.statuses.outForDelivery",
  COMPLETED: "orderStatus.statuses.completed",
  CANCELLED: "orderStatus.statuses.cancelled",
};

export default function OrderStatusPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderLookupFormInput>({
    resolver: zodResolver(orderLookupSchema),
    defaultValues: { code: "", phone: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: OrderLookupFormInput) =>
      axios
        .get<{ order: LookupOrder }>("/api/storefront/orders/lookup", { params: input })
        .then((res) => res.data.order),
  });

  const notFound =
    mutation.isError &&
    axios.isAxiosError(mutation.error) &&
    mutation.error.response?.status === 404;
  const order = mutation.data;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("orderStatus.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("orderStatus.subtitle")}</p>
      </div>

      <form
        noValidate
        onSubmit={handleSubmit((input) => mutation.mutate(input))}
        className="grid gap-4"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="lookup-code">{t("orderStatus.code")}</Label>
          <Input
            id="lookup-code"
            autoComplete="off"
            className="uppercase"
            aria-invalid={!!errors.code}
            {...register("code")}
          />
          {errors.code && (
            <p className="text-sm text-destructive">
              {translateFieldError(errors.code.message, t)}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="lookup-phone">{t("orderStatus.phone")}</Label>
          <Input
            id="lookup-phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">
              {translateFieldError(errors.phone.message, t)}
            </p>
          )}
        </div>
        {notFound ? (
          <p className="text-sm text-destructive">{t("orderStatus.notFound")}</p>
        ) : mutation.isError ? (
          <p className="text-sm text-destructive">{t("orderStatus.error")}</p>
        ) : null}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t("orderStatus.checking") : t("orderStatus.check")}
        </Button>
      </form>

      {order && (
        <Card className="py-0">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-lg font-semibold tracking-widest">{order.code}</p>
              <Badge variant={order.status === OrderStatus.CANCELLED ? "destructive" : "default"}>
                {t(STATUS_KEYS[order.status as OrderStatus])}
              </Badge>
            </div>
            <ul className="space-y-2 border-t pt-3">
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
      )}
    </div>
  );
}
