import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Clock,
  ImageOff,
  Minus,
  Phone,
  Plus,
  Shield,
  Store,
  Trash2,
  Truck,
} from "lucide-react";
import {
  checkoutFormSchema,
  DEFAULT_SETTINGS,
  FulfillmentType,
  type CheckoutFormInput,
} from "@es-market/core";
import { localize } from "@/lib/localize";
import { translateFieldError } from "@/lib/zod-error-i18n";
import { usePublicStoreSettings } from "@/lib/storefront-settings";
import { useCart, type CartItem } from "@/lib/cart";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { cn } from "@/lib/utils";
import { Money, formatCurrencyValue } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/PhoneInput";
import { Textarea } from "@/components/ui/textarea";

export type PlacedOrder = {
  code: string;
  status: string;
  fulfillmentType: FulfillmentType;
  // Optional — always present in a real API response (serializePublicOrder,
  // server/src/routes/orders.ts), but left optional here rather than
  // required so pre-existing test fixtures built before these fields
  // existed don't need updating just to satisfy the type.
  customerName?: string;
  address?: string | null;
  createdAt?: string;
  updatedAt?: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  items: {
    productName: { en: string } & Record<string, string>;
    unitPrice: number;
    quantity: number;
    // Optional for the same reason as customerName/address above — always
    // present in a real response, but pre-existing test fixtures lack it.
    imageUrl?: string | null;
  }[];
};

// Mon–Sat 8:00–20:00, Sun 9:00–14:00 — a fixed schedule, not an admin
// setting (mirrors ContactPage.tsx's identical store-hours block; not
// extracted to a shared module since it's a small, self-contained pattern
// used in exactly two places).
type DayHours = { opensAt: string; closesAt: string; opensMinute: number; closesMinute: number };
const WEEKDAY_HOURS: DayHours = {
  opensAt: "8:00",
  closesAt: "20:00",
  opensMinute: 8 * 60,
  closesMinute: 20 * 60,
};
const SUNDAY_HOURS: DayHours = {
  opensAt: "9:00",
  closesAt: "14:00",
  opensMinute: 9 * 60,
  closesMinute: 14 * 60,
};
type OpenStatus = { isOpen: boolean; isSunday: boolean; hours: DayHours };

function computeOpenStatus(now: Date): OpenStatus {
  const isSunday = now.getDay() === 0;
  const hours = isSunday ? SUNDAY_HOURS : WEEKDAY_HOURS;
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  return {
    isOpen: minutesNow >= hours.opensMinute && minutesNow < hours.closesMinute,
    isSunday,
    hours,
  };
}

// placeholder:text-muted-foreground (shadcn Input/Textarea's own default)
// follows the site's light/dark theme toggle, not this permanently-dark
// page shell — on a light-toggled visit it resolves to a gray meant for a
// white background, barely legible against bg-white/[0.04]. Overridden here
// with a literal dark-safe gray, same "forced-dark page needs a literal
// override, not a theme token" precedent as Money's prefixClassName.
const CONTROL_CLASS =
  "h-[46px] rounded-xl border-white/[0.07] bg-white/[0.04] placeholder:text-neutral-600 focus-visible:border-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/[0.16]";
const MONEY_PREFIX_CLASS = "text-[0.66em] font-semibold text-neutral-500";

export default function CheckoutPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";
  const navigate = useNavigate();
  const location = useLocation();
  // A "Buy now" purchase from the product detail page bypasses the persisted
  // cart entirely (see ProductDetailPage.tsx) — it's never added to it, so it
  // must neither pull in nor clear out whatever else is already in there.
  // Held in local state (seeded once from router state) rather than read
  // fresh from location.state every render, since it needs its own editable
  // quantity/remove handlers below.
  const [buyNowItems, setBuyNowItems] = useState<CartItem[]>(() => {
    const buyNowItem = (location.state as { buyNowItem?: CartItem } | null)?.buyNowItem;
    return buyNowItem ? [buyNowItem] : [];
  });
  const isBuyNow = buyNowItems.length > 0;
  const cart = useCart();
  const items = isBuyNow ? buyNowItems : cart.items;
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  function updateQuantity(productId: string, quantity: number) {
    if (isBuyNow) {
      setBuyNowItems((prev) =>
        prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.min(Math.max(quantity, 1), item.stock) }
            : item,
        ),
      );
    } else {
      cart.updateQuantity(productId, quantity);
    }
  }

  function removeItem(productId: string) {
    if (isBuyNow) {
      setBuyNowItems((prev) => prev.filter((item) => item.productId !== productId));
    } else {
      cart.removeItem(productId);
    }
  }

  const {
    register,
    control,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<CheckoutFormInput>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      customerName: "",
      customerPhone: "",
      fulfillmentType: FulfillmentType.DELIVERY,
      area: "",
      street: "",
      landmark: "",
      deliveryNotes: "",
    },
  });
  const fulfillmentType = watch("fulfillmentType");
  const isDelivery = fulfillmentType === FulfillmentType.DELIVERY;

  // Signed-in customers get their name/mobile prefilled from their saved
  // profile — a one-directional convenience default (same precedent as
  // ProductReviews.tsx's authorName prefill), only filling fields still at
  // their untouched default. Address prefill was dropped: the new
  // area/street/landmark fields have no single saved string to split back
  // into them.
  const { data: session } = customerAuthClient.useSession();
  const [saveAddress, setSaveAddress] = useState(false);
  useEffect(() => {
    if (!session) return;
    if (!getValues("customerName")) setValue("customerName", session.user.name);
    if (!getValues("customerPhone") && session.user.mobile) {
      setValue("customerPhone", session.user.mobile);
    }
  }, [session, getValues, setValue]);

  const { data: settings } = usePublicStoreSettings();
  const { deliveryFee: configuredFee, freeDeliveryThreshold } = settings ?? DEFAULT_SETTINGS;
  const deliveryFee =
    fulfillmentType === FulfillmentType.PICKUP ||
    (freeDeliveryThreshold !== null && subtotal >= freeDeliveryThreshold)
      ? 0
      : configuredFee;
  const total = subtotal + deliveryFee;

  const [openStatus, setOpenStatus] = useState<OpenStatus | null>(null);
  useEffect(() => {
    setOpenStatus(computeOpenStatus(new Date()));
  }, []);
  const mapQuery = settings?.contactAddress ? encodeURIComponent(settings.contactAddress) : null;

  const mutation = useMutation({
    // Posts the *raw*, pre-transform form fields (area/street/landmark/
    // deliveryNotes), not the client-side-transformed CheckoutOutput —
    // checkoutFormSchema's own .transform destructures area/street/landmark
    // away into a single joined `address` string, which placeOrderSchema
    // (server/src/routes/orders.ts) doesn't accept: it validates the same
    // raw fields checkoutFieldsSchema does and performs its own toAddress
    // transform server-side (the "server computes canonically" precedent
    // used elsewhere, e.g. order pricing). Sending the already-joined
    // `address` instead of area/landmark 400ed with "Area / ward is
    // required for delivery" every time — caught live via a real E2E
    // checkout run, not by inspection.
    mutationFn: (input: CheckoutFormInput) =>
      axios
        .post<{ order: PlacedOrder }>("/api/storefront/orders", {
          ...input,
          items: items.map(({ productId, quantity }) => ({ productId, quantity })),
        })
        .then((res) => res.data.order),
    onSuccess: (order, input) => {
      // Never automatic/silent — only writes back to the profile when the
      // customer explicitly opted in via the checkbox, same "never
      // automatic/silent" philosophy as the order-linking-by-phone flow. A
      // failure here doesn't block the already-successful order; it's a
      // best-effort second request, not part of order placement itself.
      // Uses the server-computed `order.address` (the canonical joined
      // string) rather than re-deriving it client-side a second time, since
      // `input` here is the raw pre-transform fields, not the joined value.
      if (session && saveAddress) {
        customerAuthClient
          .updateUser({
            name: input.customerName,
            mobile: input.customerPhone,
            address: order.address,
          } as Parameters<typeof customerAuthClient.updateUser>[0])
          .then(({ error }) => {
            if (error) toast.error(t("checkout.saveAddressError"));
          })
          .catch(() => toast.error(t("checkout.saveAddressError")));
      }
      if (!isBuyNow) cart.clearCart();
      navigate("/checkout/confirmation", { state: { order } });
    },
  });

  const onSubmit = handleSubmit(() => {
    // zodResolver already validated (and would have blocked submission on)
    // the full checkoutFormSchema, including requireDeliveryFields — but
    // the wire payload needs the pre-transform raw fields (see the
    // mutationFn comment above), so this reads them via getValues() rather
    // than using the transformed value RHF hands to this callback.
    mutation.mutate(getValues());
  });

  // An emptied cart means there is nothing to check out — except right after
  // a successful order, where the confirmation navigation is already
  // underway. Also covers a buy-now item removed down to zero in the
  // summary below, since there's no persisted cart to fall back to there.
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
    <div className="relative -mx-6 -my-8 min-h-[calc(100vh-1px)] overflow-hidden bg-[#0a0c0b] px-6 py-14 font-dm-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(14,165,233,0.16)_0%,transparent_70%)] reduced-transparency:hidden"
      />
      <div className="relative mx-auto max-w-[1120px] space-y-6">
        <Link
          to="/cart"
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.032] px-4 text-sm font-medium text-neutral-300 backdrop-blur-xl hover:bg-white/[0.06] reduced-transparency:bg-neutral-950 reduced-transparency:backdrop-blur-none"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {t("checkout.backToCart")}
        </Link>

        <div className="space-y-2">
          <h1 className="text-[32px] font-extrabold tracking-[-0.02em]">{t("checkout.title")}</h1>
          <p className="text-neutral-400">{t("checkout.lede")}</p>
        </div>

        <form
          noValidate
          onSubmit={onSubmit}
          className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_380px]"
        >
          {/* Left: form panels */}
          <div className="space-y-4">
            <Panel step={1} title={t("checkout.step1Title")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <FieldLabel htmlFor="checkout-name" required>
                    {t("checkout.name")}
                  </FieldLabel>
                  <Input
                    id="checkout-name"
                    autoComplete="name"
                    placeholder={t("checkout.namePlaceholder")}
                    aria-invalid={!!errors.customerName}
                    className={CONTROL_CLASS}
                    {...register("customerName")}
                  />
                  {errors.customerName && (
                    <p className="text-sm text-red-400">
                      {translateFieldError(errors.customerName.message, t)}
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <FieldLabel htmlFor="checkout-phone" required>
                    {t("checkout.phone")}
                  </FieldLabel>
                  <Controller
                    name="customerPhone"
                    control={control}
                    render={({ field }) => (
                      <PhoneInput
                        id="checkout-phone"
                        autoComplete="tel"
                        placeholder={t("checkout.phonePlaceholder")}
                        aria-invalid={!!errors.customerPhone}
                        value={field.value}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        selectClassName="h-[46px] w-[100px] shrink-0 rounded-xl border-white/[0.07] bg-white/[0.04]"
                        inputClassName={cn(CONTROL_CLASS, "flex-1")}
                      />
                    )}
                  />
                  <p className="text-[12.5px] text-neutral-500">{t("checkout.phoneHelper")}</p>
                  {errors.customerPhone && (
                    <p className="text-sm text-red-400">
                      {translateFieldError(errors.customerPhone.message, t)}
                    </p>
                  )}
                </div>
              </div>
            </Panel>

            <Panel step={2} title={t("checkout.step2Title")}>
              <div className="space-y-4">
                <Controller
                  name="fulfillmentType"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-2.5">
                      <FulfillmentCard
                        selected={field.value === FulfillmentType.DELIVERY}
                        icon={Truck}
                        title={t("checkout.delivery")}
                        description={t("checkout.deliveryDescription")}
                        price={
                          <Money
                            amount={configuredFee}
                            prefixClassName={MONEY_PREFIX_CLASS}
                          />
                        }
                        onSelect={() => field.onChange(FulfillmentType.DELIVERY)}
                      />
                      <FulfillmentCard
                        selected={field.value === FulfillmentType.PICKUP}
                        icon={Store}
                        title={t("checkout.pickupCardTitle")}
                        description={t("checkout.pickupDescription")}
                        price={t("checkout.free")}
                        onSelect={() => field.onChange(FulfillmentType.PICKUP)}
                      />
                    </div>
                  )}
                />

                {isDelivery ? (
                  <div className="space-y-4 border-t border-white/[0.07] pt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <FieldLabel htmlFor="checkout-area" required>
                          {t("checkout.areaLabel")}
                        </FieldLabel>
                        <Input
                          id="checkout-area"
                          placeholder={t("checkout.areaPlaceholder")}
                          aria-invalid={!!errors.area}
                          className={CONTROL_CLASS}
                          {...register("area")}
                        />
                        {errors.area && (
                          <p className="text-sm text-red-400">
                            {translateFieldError(errors.area.message, t)}
                          </p>
                        )}
                      </div>
                      <div className="grid gap-2">
                        <FieldLabel htmlFor="checkout-street">
                          {t("checkout.streetLabel")}
                        </FieldLabel>
                        <Input
                          id="checkout-street"
                          placeholder={t("checkout.streetPlaceholder")}
                          className={CONTROL_CLASS}
                          {...register("street")}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="checkout-landmark" required>
                        {t("checkout.landmarkLabel")}
                      </FieldLabel>
                      <Input
                        id="checkout-landmark"
                        placeholder={t("checkout.landmarkPlaceholder")}
                        aria-invalid={!!errors.landmark}
                        className={CONTROL_CLASS}
                        {...register("landmark")}
                      />
                      <p className="text-[12.5px] text-neutral-500">
                        {t("checkout.landmarkHelper")}
                      </p>
                      {errors.landmark && (
                        <p className="text-sm text-red-400">
                          {translateFieldError(errors.landmark.message, t)}
                        </p>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="checkout-notes">{t("checkout.notesLabel")}</FieldLabel>
                      <Textarea
                        id="checkout-notes"
                        rows={3}
                        placeholder={t("checkout.notesPlaceholder")}
                        className="min-h-[90px] rounded-xl border-white/[0.07] bg-white/[0.04] placeholder:text-neutral-600 focus-visible:border-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/[0.16]"
                        {...register("deliveryNotes")}
                      />
                    </div>
                    {session && (
                      <Label className="flex items-center gap-2 text-sm font-normal text-neutral-300">
                        <Checkbox
                          id="checkout-save-address"
                          checked={saveAddress}
                          onCheckedChange={(checked) => setSaveAddress(checked === true)}
                        />
                        {t("checkout.saveAddress")}
                      </Label>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 border-t border-white/[0.07] pt-4">
                    <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                      {settings?.contactAddress && (
                        <p className="flex items-center gap-2 text-sm font-semibold text-white">
                          <Store aria-hidden className="size-4 shrink-0 text-sky-500" />
                          {settings.contactAddress}
                        </p>
                      )}
                      {openStatus && (
                        <div className="space-y-1 text-[13px]">
                          <div
                            className={cn(
                              "flex justify-between",
                              !openStatus.isSunday ? "text-white" : "text-neutral-500",
                            )}
                          >
                            <span>{t("contact.hoursMonSat")}</span>
                            <span>{t("contact.hoursMonSatTime")}</span>
                          </div>
                          <div
                            className={cn(
                              "flex justify-between",
                              openStatus.isSunday ? "text-white" : "text-neutral-500",
                            )}
                          >
                            <span>{t("contact.hoursSun")}</span>
                            <span>{t("contact.hoursSunTime")}</span>
                          </div>
                        </div>
                      )}
                      {mapQuery && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-semibold text-sky-400 hover:text-sky-300"
                        >
                          {t("contact.getDirections")}
                          <ArrowUpRight aria-hidden className="size-3.5" />
                        </a>
                      )}
                    </div>
                    <div className="grid gap-2">
                      <FieldLabel htmlFor="checkout-pickup-notes">
                        {t("checkout.pickupNotesLabel")}
                      </FieldLabel>
                      <Textarea
                        id="checkout-pickup-notes"
                        rows={3}
                        placeholder={t("checkout.pickupNotesPlaceholder")}
                        className="min-h-[90px] rounded-xl border-white/[0.07] bg-white/[0.04] placeholder:text-neutral-600 focus-visible:border-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/[0.16]"
                        {...register("deliveryNotes")}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          </div>

          {/* Right: sticky summary */}
          <aside className="sticky top-6 space-y-4">
            <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.032] p-[22px] backdrop-blur-xl reduced-transparency:bg-neutral-950 reduced-transparency:backdrop-blur-none">
              <h2 className="mb-4 flex items-baseline justify-between font-semibold text-white">
                {t("checkout.summary")}
                <span className="text-sm font-normal text-neutral-500">
                  {t("products.itemCount", { count: items.length })}
                </span>
              </h2>

              <ul className="space-y-3">
                {items.map((item) => {
                  const name = localize(item.name, language);
                  return (
                    <li key={item.productId} className="flex gap-3">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={name}
                          className="size-[52px] shrink-0 rounded-lg border border-white/[0.07] bg-white object-cover"
                        />
                      ) : (
                        <div
                          aria-label={t("products.noImage")}
                          className="flex size-[52px] shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]"
                        >
                          <ImageOff className="size-5 text-neutral-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium text-white">{name}</p>
                          <p className="shrink-0 text-sm font-semibold tabular-nums text-white">
                            <Money
                              amount={item.price * item.quantity}
                              prefixClassName={MONEY_PREFIX_CLASS}
                            />
                          </p>
                        </div>
                        <p className="text-[12px] text-neutral-500">
                          <Money amount={item.price} prefixClassName={MONEY_PREFIX_CLASS} />{" "}
                          {t("checkout.each")}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={t("cart.decrease", { name })}
                              disabled={item.quantity <= 1}
                              onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                              className="grid size-6 place-items-center rounded-md border border-white/[0.07] bg-white/[0.04] text-white disabled:opacity-40"
                            >
                              <Minus className="size-3" />
                            </button>
                            <span className="w-5 text-center text-xs tabular-nums text-white">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label={t("cart.increase", { name })}
                              disabled={item.quantity >= item.stock}
                              onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                              className="grid size-6 place-items-center rounded-md border border-white/[0.07] bg-white/[0.04] text-white disabled:opacity-40"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.productId)}
                            className="flex items-center gap-1 text-[12px] font-medium text-neutral-500 hover:text-red-400"
                          >
                            <Trash2 className="size-3" />
                            {t("cart.remove", { name })}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 space-y-1.5 border-t border-white/[0.07] pt-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-400">{t("cart.subtotal")}</span>
                  <span className="tabular-nums text-white">
                    <Money amount={subtotal} prefixClassName={MONEY_PREFIX_CLASS} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">
                    {isDelivery ? t("checkout.deliveryFee") : t("checkout.pickup")}
                  </span>
                  <span className="tabular-nums text-white">
                    {deliveryFee === 0 ? (
                      t("checkout.free")
                    ) : (
                      <Money amount={deliveryFee} prefixClassName={MONEY_PREFIX_CLASS} />
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-white/[0.07] pt-2.5 text-[19px] font-extrabold text-white">
                  <span>{t("checkout.totalDue")}</span>
                  <span className="tabular-nums">
                    <Money amount={total} prefixClassName="text-[0.66em] font-semibold text-neutral-500" />
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-[18px] border border-white/[0.07] bg-white/[0.032] p-[22px] backdrop-blur-xl reduced-transparency:bg-neutral-950 reduced-transparency:backdrop-blur-none">
              <TrustLine icon={Shield} text={t("checkout.trustCash")} />
              <TrustLine icon={Clock} text={t("checkout.trustDelivery")} />
              <TrustLine icon={Phone} text={t("checkout.trustCall")} />

              {serverError && <p className="text-sm text-red-400">{serverError}</p>}

              <Button
                type="submit"
                disabled={mutation.isPending}
                className="h-[52px] w-full rounded-[13px] bg-sky-500 text-base font-bold text-[#06140b] hover:bg-sky-400"
              >
                {mutation.isPending
                  ? t("checkout.placing")
                  : t("checkout.placeOrderWithTotal", {
                      total: `TSh ${formatCurrencyValue(total)}`,
                    })}
              </Button>
              <p className="text-center text-[12.5px] text-neutral-500">
                {t("checkout.confirmationNote")}
              </p>
              <p className="text-center text-[12.5px]">
                <Link to="/policy#returns" className="text-sky-500 underline hover:text-sky-400">
                  {t("checkout.returnPolicyLink")}
                </Link>
              </p>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}

function Panel({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <div className="rounded-[18px] border border-white/[0.07] bg-white/[0.032] p-[22px] backdrop-blur-xl reduced-transparency:bg-neutral-950 reduced-transparency:backdrop-blur-none">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-full border border-sky-500/25 bg-sky-500/10 text-xs font-bold text-sky-500">
          {step}
        </span>
        <h2 className="font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  required,
  children,
}: {
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="text-[11.5px] font-semibold tracking-[0.08em] text-neutral-500 uppercase"
    >
      {children}
      {required && <span className="text-sky-500"> *</span>}
    </Label>
  );
}

function FulfillmentCard({
  selected,
  icon: Icon,
  title,
  description,
  price,
  onSelect,
}: {
  selected: boolean;
  icon: typeof Truck;
  title: string;
  description: string;
  price: ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={title}
      className={cn(
        "relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-start transition-colors",
        selected
          ? "border-sky-500 bg-sky-500/[0.07] ring-[3px] ring-sky-500/[0.12]"
          : "border-white/[0.07] bg-white/[0.032] hover:bg-white/[0.05]",
      )}
    >
      {selected && (
        <span className="absolute end-3 top-3 grid size-5 place-items-center rounded-full bg-sky-500 text-[#06140b]">
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        </span>
      )}
      <span className="grid size-10 place-items-center rounded-xl border border-sky-500/20 bg-sky-500/10">
        <Icon aria-hidden className="size-5 text-sky-500" />
      </span>
      <span className="font-semibold text-white">{title}</span>
      <span className="text-[13px] text-neutral-400">{description}</span>
      <span className="text-sm font-semibold text-white">{price}</span>
    </button>
  );
}

function TrustLine({ icon: Icon, text }: { icon: typeof Shield; text: string }) {
  return (
    <p className="flex items-center gap-2.5 text-[13px] text-neutral-300">
      <Icon aria-hidden className="size-4 shrink-0 text-sky-500" />
      {text}
    </p>
  );
}
