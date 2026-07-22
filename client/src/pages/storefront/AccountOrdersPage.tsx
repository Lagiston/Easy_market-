import { useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  linkGuestOrdersSchema,
  OrderStatus,
  type LinkGuestOrdersInput,
} from "@es-market/core";
import { localize } from "@/lib/localize";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlacedOrder } from "./CheckoutPage";

type AccountOrder = PlacedOrder & { createdAt: string };

const STATUS_KEYS: Record<OrderStatus, string> = {
  RECEIVED: "orderStatus.statuses.received",
  CONFIRMED: "orderStatus.statuses.confirmed",
  OUT_FOR_DELIVERY: "orderStatus.statuses.outForDelivery",
  COMPLETED: "orderStatus.statuses.completed",
  CANCELLED: "orderStatus.statuses.cancelled",
};

export default function AccountOrdersPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const queryClient = useQueryClient();
  const [linkedCount, setLinkedCount] = useState<number | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ["customer", "orders"],
    queryFn: () =>
      axios
        .get<{ orders: AccountOrder[] }>("/api/customer/orders")
        .then((res) => res.data.orders),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LinkGuestOrdersInput>({
    resolver: zodResolver(linkGuestOrdersSchema),
  });

  const linkMutation = useMutation({
    mutationFn: (input: LinkGuestOrdersInput) =>
      axios
        .post<{ linkedCount: number }>("/api/customer/orders/link-by-phone", input)
        .then((res) => res.data.linkedCount),
    onSuccess: (count) => {
      setLinkedCount(count);
      reset();
      if (count > 0) {
        queryClient.invalidateQueries({ queryKey: ["customer", "orders"] });
      }
    },
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("account.orders.title")}</h1>

      <form
        noValidate
        onSubmit={handleSubmit((input) => {
          setLinkedCount(null);
          linkMutation.mutate(input);
        })}
        className="flex items-end gap-2"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="link-phone">{t("account.orders.linkPhoneLabel")}</Label>
          <Input
            id="link-phone"
            type="tel"
            autoComplete="tel"
            aria-invalid={!!errors.phone}
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>
        <Button type="submit" variant="outline" disabled={linkMutation.isPending}>
          {t("account.orders.linkPhoneSubmit")}
        </Button>
      </form>
      {linkedCount !== null && (
        <p className="text-sm text-muted-foreground">
          {linkedCount > 0
            ? t("account.orders.linkPhoneSuccess", { count: linkedCount })
            : t("account.orders.linkPhoneNoMatch")}
        </p>
      )}
      {linkMutation.isError && (
        <p className="text-sm text-destructive">{t("account.orders.linkPhoneError")}</p>
      )}

      {isError ? (
        <p className="py-12 text-center text-sm text-destructive">
          {t("account.orders.error")}
        </p>
      ) : isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("account.orders.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {data.map((order) => (
            <Card key={order.code} className="py-0">
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
                <div className="flex justify-between border-t pt-3 text-base font-semibold">
                  <span>{t("checkout.total")}</span>
                  <span className="tabular-nums">{order.total}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
