import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import axios from "axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  checkoutFormSchema,
  DEFAULT_SETTINGS,
  FulfillmentType,
  type CheckoutFormInput,
  type StoreSettings,
} from "@es-market/core";
import { localize } from "@/lib/localize";
import { translateFieldError } from "@/lib/zod-error-i18n";
import { useCart, type CartItem } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/PhoneInput";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type PlacedOrder = {
  code: string;
  status: string;
  fulfillmentType: FulfillmentType;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: { productName: { en: string } & Record<string, string>; unitPrice: number; quantity: number }[];
};

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const navigate = useNavigate();
  const location = useLocation();
  // A "Buy now" purchase from the product detail page bypasses the persisted
  // cart entirely (see ProductDetailPage.tsx) — it's never added to it, so it
  // must neither pull in nor clear out whatever else is already in there.
  const buyNowItem = (location.state as { buyNowItem?: CartItem } | null)?.buyNowItem;
  const { items: cartItems, subtotal: cartSubtotal, clearCart } = useCart();
  const items = buyNowItem ? [buyNowItem] : cartItems;
  const subtotal = buyNowItem ? buyNowItem.price * buyNowItem.quantity : cartSubtotal;

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CheckoutFormInput>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      fulfillmentType: FulfillmentType.DELIVERY,
      address: "",
    },
  });
  const fulfillmentType = watch("fulfillmentType");

  const { data: settings } = useQuery({
    queryKey: ["storefront", "settings"],
    queryFn: () =>
      axios
        .get<{ settings: StoreSettings }>("/api/storefront/settings")
        .then((res) => res.data.settings),
  });
  const { deliveryFee: configuredFee, freeDeliveryThreshold } = settings ?? DEFAULT_SETTINGS;
  const deliveryFee =
    fulfillmentType === FulfillmentType.PICKUP ||
    (freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold)
      ? 0
      : configuredFee;

  const mutation = useMutation({
    mutationFn: (input: CheckoutFormInput) =>
      axios
        .post<{ order: PlacedOrder }>("/api/storefront/orders", {
          ...input,
          items: items.map(({ productId, quantity }) => ({ productId, quantity })),
        })
        .then((res) => res.data.order),
    onSuccess: (order) => {
      if (!buyNowItem) clearCart();
      navigate("/checkout/confirmation", { state: { order } });
    },
  });

  // An emptied cart means there is nothing to check out — except right after a
  // successful order, where the confirmation navigation is already underway.
  useEffect(() => {
    if (items.length === 0 && !mutation.isSuccess) {
      navigate("/cart", { replace: true });
    }
  }, [items.length, mutation.isSuccess, navigate]);

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("checkout.error")
    : null;

  if (items.length === 0) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold">{t("checkout.title")}</h1>

      <div className="grid gap-8 sm:grid-cols-2">
        <form
          noValidate
          onSubmit={handleSubmit((input) => mutation.mutate(input))}
          className="grid content-start gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="checkout-name">{t("checkout.name")}</Label>
            <Input
              id="checkout-name"
              autoComplete="name"
              aria-invalid={!!errors.customerName}
              {...register("customerName")}
            />
            {errors.customerName && (
              <p className="text-sm text-destructive">
                {translateFieldError(errors.customerName.message, t)}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="checkout-phone">{t("checkout.phone")}</Label>
            <Controller
              name="customerPhone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  id="checkout-phone"
                  autoComplete="tel"
                  aria-invalid={!!errors.customerPhone}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                />
              )}
            />
            {errors.customerPhone && (
              <p className="text-sm text-destructive">
                {translateFieldError(errors.customerPhone.message, t)}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="checkout-fulfillment">{t("checkout.fulfillment")}</Label>
            <Controller
              name="fulfillmentType"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="checkout-fulfillment">
                    <SelectValue>
                      {(value: string) =>
                        value === FulfillmentType.PICKUP
                          ? t("checkout.pickup")
                          : t("checkout.delivery")
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FulfillmentType.DELIVERY}>
                      {t("checkout.delivery")}
                    </SelectItem>
                    <SelectItem value={FulfillmentType.PICKUP}>
                      {t("checkout.pickup")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {fulfillmentType === FulfillmentType.DELIVERY && (
            <div className="grid gap-1.5">
              <Label htmlFor="checkout-address">{t("checkout.address")}</Label>
              <Input
                id="checkout-address"
                autoComplete="street-address"
                aria-invalid={!!errors.address}
                {...register("address")}
              />
              <p className="text-sm text-muted-foreground">{t("checkout.cityOnly")}</p>
              {errors.address && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.address.message, t)}
                </p>
              )}
            </div>
          )}
          <p className="text-sm text-muted-foreground">{t("checkout.payNote")}</p>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? t("checkout.placing") : t("checkout.placeOrder")}
          </Button>
        </form>

        <Card className="h-fit py-0">
          <CardContent className="space-y-3 p-4">
            <h2 className="font-medium">{t("checkout.summary")}</h2>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.productId} className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate">
                    {localize(item.name, language)} × {item.quantity}
                  </span>
                  <span className="tabular-nums">{item.price * item.quantity}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("cart.subtotal")}</span>
                <span className="tabular-nums">{subtotal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("checkout.deliveryFee")}</span>
                <span className="tabular-nums">
                  {deliveryFee === 0 ? t("checkout.free") : deliveryFee}
                </span>
              </div>
              <div className="flex justify-between pt-1 text-base font-semibold">
                <span>{t("checkout.total")}</span>
                <span className="tabular-nums">{subtotal + deliveryFee}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
