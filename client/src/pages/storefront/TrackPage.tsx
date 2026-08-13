import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import axios from "axios";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  Loader2,
  MessageCircle,
  Package,
  Search,
  Truck,
} from "lucide-react";
import {
  FulfillmentType,
  InquiryStatus,
  MessageSender,
  OrderStatus,
  inquiryLookupSchema,
  orderLookupSchema,
} from "@es-market/core";
import { localize } from "@/lib/localize";
import { translateFieldError } from "@/lib/zod-error-i18n";
import { formatPhoneDisplay } from "@/lib/contact-links";
import { setStoredInquiryId } from "@/lib/inquiry-session";
import { cn } from "@/lib/utils";
import { Money } from "@/components/Money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PlacedOrder } from "./CheckoutPage";

type Mode = "order" | "message";

// Both orderLookupSchema and inquiryLookupSchema share the exact same
// {code, phone} shape (see core/src/schemas/order.ts and inquiry.ts) — one
// shared form, one shared field-level type, resolver swapped per mode.
type LookupFormInput = { code: string; phone: string };

type LookupOrder = PlacedOrder & { createdAt: string; updatedAt: string };

type LookupMessage = { id: string; sender: MessageSender; body: string; createdAt: string };

type LookupInquiry = {
  id: string;
  code: string;
  status: InquiryStatus;
  customerName: string;
  createdAt: string;
  // Derived boolean from the server, not the raw assignedAgentId — see
  // server/src/routes/inquiries.ts's /storefront/inquiries/lookup.
  assigned: boolean;
  messages: LookupMessage[];
};

// Order steps mirror the real OrderStatus progression; pickup orders skip
// OUT_FOR_DELIVERY entirely (server/src/routes/orders.ts transitions
// { fulfillmentType: PICKUP, status: CONFIRMED } straight to COMPLETED).
// There's no "packed" status anywhere in the data model, so it isn't a step.
const ORDER_STEPS_DELIVERY = [
  OrderStatus.RECEIVED,
  OrderStatus.CONFIRMED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.COMPLETED,
] as const;
const ORDER_STEPS_PICKUP = [
  OrderStatus.RECEIVED,
  OrderStatus.CONFIRMED,
  OrderStatus.COMPLETED,
] as const;

const ORDER_TIMELINE_LABEL_KEYS: Record<OrderStatus, string> = {
  [OrderStatus.RECEIVED]: "track.order.timeline.received",
  [OrderStatus.CONFIRMED]: "track.order.timeline.confirmed",
  [OrderStatus.OUT_FOR_DELIVERY]: "track.order.timeline.outForDelivery",
  [OrderStatus.COMPLETED]: "track.order.timeline.delivered",
  [OrderStatus.CANCELLED]: "track.order.statuses.cancelled",
};

const ORDER_STATUS_LABEL_KEYS: Record<OrderStatus, string> = {
  [OrderStatus.RECEIVED]: "track.order.statuses.received",
  [OrderStatus.CONFIRMED]: "track.order.statuses.confirmed",
  [OrderStatus.OUT_FOR_DELIVERY]: "track.order.statuses.outForDelivery",
  [OrderStatus.COMPLETED]: "track.order.statuses.completed",
  [OrderStatus.CANCELLED]: "track.order.statuses.cancelled",
};

// Message steps are derived from real fields, not a stored per-step status:
// "received" is always true, "assigned" from the server's derived boolean,
// "replied" from whether any non-CUSTOMER message exists in the (already
// AI_DRAFT-leak-filtered) messages array, "closed" from status. No
// fabricated per-step timestamps beyond createdAt (received) — the other
// three steps have no reliable timestamp of their own, same restraint as
// the order timeline.
const MESSAGE_STEPS = ["received", "assigned", "replied", "closed"] as const;
type MessageStep = (typeof MESSAGE_STEPS)[number];

const MESSAGE_TIMELINE_LABEL_KEYS: Record<MessageStep, string> = {
  received: "track.message.timeline.received",
  assigned: "track.message.timeline.assigned",
  replied: "track.message.timeline.replied",
  closed: "track.message.timeline.closed",
};

const MESSAGE_STATUS_LABEL_KEYS: Record<InquiryStatus, string> = {
  [InquiryStatus.OPEN]: "track.message.statuses.open",
  [InquiryStatus.RESOLVED]: "track.message.statuses.resolved",
  [InquiryStatus.CLOSED]: "track.message.statuses.closed",
};

const CONTROL_CLASS =
  "h-12 rounded-[13px] border-white/[0.07] bg-white/[0.04] text-[15px] focus-visible:border-sky-500 focus-visible:ring-4 focus-visible:ring-sky-500/[0.16]";

// This page forces a permanently-dark shell regardless of the site's actual
// light/dark toggle — Money's default text-muted-foreground prefix would
// resolve to a light-mode color here, so every amount on this page passes
// this literal override instead.
const MONEY_PREFIX_CLASS = "text-[0.66em] font-semibold text-neutral-500";

type TimelineState = "completed" | "current" | "upcoming";

// Shared 26px-bead timeline, used by both the order and message results —
// only the step list/labels/timestamps differ per mode.
function Timeline({
  steps,
  currentIndex,
  language,
}: {
  steps: { key: string; label: string; timestamp?: string | null }[];
  currentIndex: number;
  language: string;
}) {
  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const state: TimelineState =
          index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming";
        const isLast = index === steps.length - 1;
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "grid size-[26px] shrink-0 place-items-center rounded-full",
                  state === "completed" && "bg-sky-500 text-[#06140b]",
                  state === "current" &&
                    "bg-amber-500 text-[#1a1203] shadow-[0_0_0_5px_rgba(245,158,11,0.16)]",
                  state === "upcoming" && "border border-white/[0.16] bg-transparent",
                )}
              >
                {state === "completed" && <Check aria-hidden className="size-3.5" />}
                {state === "current" && <ArrowRight aria-hidden className="size-3.5" />}
              </span>
              {!isLast && (
                <span
                  className={cn(
                    "min-h-6 w-0.5 flex-1",
                    state === "completed" ? "bg-sky-500" : "bg-white/[0.12]",
                  )}
                />
              )}
            </div>
            <div className={cn("min-w-0 pb-6", isLast && "pb-0")}>
              <p
                className={cn(
                  "text-sm",
                  state === "current" && "font-bold text-white",
                  state === "completed" && "font-medium text-white",
                  state === "upcoming" && "font-medium text-neutral-500",
                )}
              >
                {step.label}
              </p>
              {step.timestamp && (
                <p
                  className={cn("text-xs", state === "current" ? "text-amber-400" : "text-neutral-500")}
                >
                  {new Date(step.timestamp).toLocaleString(language, {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "amber" | "sky" | "gray" | "red";
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap",
        tone === "red" && "border-red-500/32 bg-red-500/[0.14] text-red-400",
        tone === "sky" && "border-sky-500/32 bg-sky-500/[0.14] text-sky-400",
        tone === "amber" && "border-amber-500/32 bg-amber-500/[0.14] text-amber-400",
        tone === "gray" && "border-white/[0.16] bg-white/[0.06] text-neutral-400",
      )}
    >
      {label}
    </span>
  );
}

export default function TrackPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "en";

  // Deep-link support (SMS links, the post-checkout confirmation screen):
  // /t/:code or /track?code=XXX. Read once on mount, same "don't sync back
  // to the URL" idiom as ProductsPage.tsx's own `?tag=` handling — this only
  // ever seeds the initial mode/field value/focus target below, it never
  // fetches or submits anything by itself. The mandatory phone-confirmation
  // step is what keeps a shared link from exposing anyone's order/message
  // to whoever else sees it.
  const { code: codeFromPath } = useParams<{ code?: string }>();
  const [searchParams] = useSearchParams();
  const deepLinkedCode = (codeFromPath ?? searchParams.get("code") ?? "").toUpperCase();

  const [mode, setMode] = useState<Mode>(() =>
    deepLinkedCode.startsWith("MSG") ? "message" : "order",
  );

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<LookupFormInput>({
    resolver: zodResolver(mode === "order" ? orderLookupSchema : inquiryLookupSchema),
    defaultValues: { code: deepLinkedCode, phone: "" },
  });

  const orderMutation = useMutation({
    mutationFn: (input: LookupFormInput) =>
      axios
        .get<{ order: LookupOrder }>("/api/storefront/orders/lookup", { params: input })
        .then((res) => res.data.order),
  });

  const messageMutation = useMutation({
    mutationFn: (input: LookupFormInput) =>
      axios
        .get<{ inquiry: LookupInquiry }>("/api/storefront/inquiries/lookup", { params: input })
        .then((res) => res.data.inquiry),
    onSuccess: (inquiry) => {
      // Lets the chat widget resume this thread too, e.g. after a guest lost
      // localStorage but still knows their code + phone.
      setStoredInquiryId(inquiry.id);
    },
  });

  const activeMutation = mode === "order" ? orderMutation : messageMutation;
  const hasResult = mode === "order" ? !!orderMutation.data : !!messageMutation.data;
  const lookupPhone = activeMutation.variables?.phone;

  const notFound =
    activeMutation.isError &&
    axios.isAxiosError(activeMutation.error) &&
    activeMutation.error.response?.status === 404;

  // One alert card surfaces whichever error is most relevant, in priority
  // order — client-side format errors first, then the server's no-match
  // response, then a generic failure. The code/phone-format messages come
  // straight from whichever schema is active, so they're already
  // mode-specific ("Order codes are..." vs "Message codes are...");
  // errorTitle/notFound are plain UI copy, also mode-specific.
  const activeError: { field: "code" | "phone" | null; message: string } | null = errors.code
    ? { field: "code", message: translateFieldError(errors.code.message, t) ?? "" }
    : errors.phone
      ? { field: "phone", message: translateFieldError(errors.phone.message, t) ?? "" }
      : notFound
        ? { field: null, message: t(`track.${mode}.notFound`) }
        : activeMutation.isError
          ? { field: null, message: t("track.error") }
          : null;

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    orderMutation.reset();
    messageMutation.reset();
    resetForm();
  }

  function trackAnother() {
    orderMutation.reset();
    messageMutation.reset();
    resetForm();
  }

  return (
    <div className="relative -mx-6 -my-8 min-h-[calc(100vh-1px)] overflow-hidden bg-[#0a0c0b] px-6 py-14 font-dm-sans text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(14,165,233,0.16)_0%,transparent_70%)] reduced-transparency:hidden"
      />
      <div
        className={cn(
          "relative mx-auto space-y-6 transition-[max-width] duration-300 motion-reduce:transition-none",
          hasResult ? "max-w-[640px]" : "max-w-[520px]",
        )}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid size-13 place-items-center rounded-[15px] border border-sky-500/25 bg-sky-500/10">
            {mode === "order" ? (
              <Truck aria-hidden className="size-6 text-sky-500" />
            ) : (
              <MessageCircle aria-hidden className="size-6 text-sky-500" />
            )}
          </span>
          <h1 className="text-[32px] font-extrabold tracking-[-0.03em]">{t("track.title")}</h1>
          <p className="text-neutral-400">
            {deepLinkedCode ? t("track.confirmPhoneSubtitle") : t(`track.${mode}.subtitle`)}
          </p>
        </div>

        {!hasResult && (
          <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-white/[0.07] bg-white/[0.032] p-1">
            <button
              type="button"
              onClick={() => switchMode("order")}
              className={cn(
                "flex h-[42px] items-center justify-center gap-1.5 rounded-[11px] text-sm font-semibold text-neutral-400",
                mode === "order" && "bg-white font-bold text-[#0a0c0b]",
              )}
            >
              <Truck aria-hidden className="size-4" />
              {t("track.toggleOrder")}
            </button>
            <button
              type="button"
              onClick={() => switchMode("message")}
              className={cn(
                "flex h-[42px] items-center justify-center gap-1.5 rounded-[11px] text-sm font-semibold text-neutral-400",
                mode === "message" && "bg-white font-bold text-[#0a0c0b]",
              )}
            >
              <MessageCircle aria-hidden className="size-4" />
              {t("track.toggleMessage")}
            </button>
          </div>
        )}

        {!hasResult ? (
          <div className="space-y-5 rounded-[20px] border border-white/[0.07] bg-white/[0.032] p-6 backdrop-blur-xl reduced-transparency:bg-neutral-950 reduced-transparency:backdrop-blur-none">
            <form
              noValidate
              onSubmit={handleSubmit((input) => activeMutation.mutate(input))}
              className="grid gap-4"
            >
              <div className="grid gap-2">
                <Label
                  htmlFor="lookup-code"
                  className="text-[11.5px] font-semibold tracking-[0.08em] text-neutral-500 uppercase"
                >
                  {t(`track.${mode}.label`)}
                </Label>
                <Input
                  id="lookup-code"
                  autoComplete="off"
                  autoFocus={!deepLinkedCode}
                  maxLength={8}
                  placeholder={t(`track.${mode}.placeholder`)}
                  aria-invalid={activeError?.field === "code"}
                  className={cn(
                    CONTROL_CLASS,
                    "font-semibold uppercase tracking-[0.14em]",
                    activeError?.field === "code" && "border-red-500",
                  )}
                  {...register("code")}
                />
                <p className="text-[12.5px] text-neutral-500">{t(`track.${mode}.hint`)}</p>
              </div>
              <div className="grid gap-2">
                <Label
                  htmlFor="lookup-phone"
                  className="text-[11.5px] font-semibold tracking-[0.08em] text-neutral-500 uppercase"
                >
                  {t("track.phone")}
                </Label>
                <Input
                  id="lookup-phone"
                  type="tel"
                  autoComplete="tel"
                  autoFocus={!!deepLinkedCode}
                  placeholder={t("track.phonePlaceholder")}
                  aria-invalid={activeError?.field === "phone"}
                  className={cn(CONTROL_CLASS, activeError?.field === "phone" && "border-red-500")}
                  {...register("phone")}
                />
                <p className="text-[12.5px] text-neutral-500">{t("track.phoneHint")}</p>
              </div>

              <Button
                type="submit"
                disabled={activeMutation.isPending}
                className="h-[50px] w-full gap-2 rounded-[13px] bg-sky-500 font-bold text-[#06140b] hover:bg-sky-400"
              >
                {activeMutation.isPending ? (
                  <>
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                    {t("track.checking")}
                  </>
                ) : (
                  <>
                    <Search aria-hidden className="size-4" />
                    {t("track.check")}
                  </>
                )}
              </Button>

              {activeError && (
                <div className="flex items-start gap-3 rounded-[13px] border border-red-500/30 bg-red-500/[0.08] p-4">
                  <AlertCircle aria-hidden className="size-5 shrink-0 text-red-400" />
                  <div className="space-y-0.5">
                    <p className="font-bold text-red-400">{t(`track.${mode}.errorTitle`)}</p>
                    <p className="text-sm text-red-300/90">{activeError.message}</p>
                  </div>
                </div>
              )}
            </form>

            <div className="space-y-3 border-t border-white/[0.07] pt-5 text-center">
              <p className="text-sm text-neutral-400">{t("track.fallbackPrompt")}</p>
              <a
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  window.HalatuChat?.open();
                }}
                className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-sky-500/30 bg-sky-500/10 px-4 text-sm font-semibold text-sky-300 hover:bg-sky-500/15"
              >
                <MessageCircle aria-hidden className="size-4" />
                {t("track.chatWithUs")}
              </a>
            </div>
          </div>
        ) : mode === "order" && orderMutation.data ? (
          <OrderResultPanel
            order={orderMutation.data}
            language={language}
            t={t}
            lookupPhone={lookupPhone}
            onTrackAnother={trackAnother}
          />
        ) : messageMutation.data ? (
          <MessageResultPanel
            inquiry={messageMutation.data}
            language={language}
            t={t}
            onTrackAnother={trackAnother}
          />
        ) : null}
      </div>
    </div>
  );
}

function OrderResultPanel({
  order,
  language,
  t,
  lookupPhone,
  onTrackAnother,
}: {
  order: LookupOrder;
  language: string;
  t: TFunction;
  lookupPhone?: string;
  onTrackAnother: () => void;
}) {
  const status = order.status as OrderStatus;
  const isCancelled = status === OrderStatus.CANCELLED;
  const isDelivered = status === OrderStatus.COMPLETED;
  const isDelivery = order.fulfillmentType === FulfillmentType.DELIVERY;
  const steps: readonly OrderStatus[] = isDelivery ? ORDER_STEPS_DELIVERY : ORDER_STEPS_PICKUP;
  const currentIndex = isCancelled ? -1 : steps.indexOf(status);

  const orderDate = new Date(order.createdAt).toLocaleDateString(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-6 rounded-[20px] border border-white/[0.07] bg-white/[0.032] p-6 backdrop-blur-xl reduced-transparency:bg-neutral-950 reduced-transparency:backdrop-blur-none">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            {t("track.order.orderLabel")}
          </p>
          <p className="text-[22px] font-extrabold tracking-[0.06em]">{order.code}</p>
          <p className="text-sm text-neutral-400">
            {order.customerName ? `${order.customerName} · ` : ""}
            {orderDate}
          </p>
        </div>
        <StatusChip
          label={t(ORDER_STATUS_LABEL_KEYS[status])}
          tone={isCancelled ? "red" : isDelivered ? "sky" : "amber"}
        />
      </div>

      {status === OrderStatus.OUT_FOR_DELIVERY && (
        <div className="flex items-start gap-3 rounded-[13px] border border-sky-500/25 bg-sky-500/[0.07] p-4">
          <Clock aria-hidden className="size-5 shrink-0 text-sky-500" />
          <div>
            <p className="font-semibold text-white">{t("track.order.eta.title")}</p>
            {lookupPhone && (
              <p className="text-sm text-neutral-400">
                {t("track.order.eta.detail", { phone: formatPhoneDisplay(lookupPhone) })}
              </p>
            )}
          </div>
        </div>
      )}

      {isCancelled ? (
        <p className="rounded-[13px] border border-white/[0.07] bg-white/[0.03] p-4 text-sm text-neutral-400">
          {t("track.order.cancelledNotice")}
        </p>
      ) : (
        <Timeline
          language={language}
          currentIndex={currentIndex}
          steps={steps.map((step, index) => ({
            key: step,
            label: t(ORDER_TIMELINE_LABEL_KEYS[step]),
            timestamp: index === 0 ? order.createdAt : index === currentIndex ? order.updatedAt : null,
          }))}
        />
      )}

      <div className="space-y-3 border-t border-white/[0.07] pt-5">
        <ul className="space-y-3">
          {order.items.map((item, index) => (
            <li key={index} className="flex items-center gap-3">
              <span className="grid size-[42px] shrink-0 place-items-center overflow-hidden rounded-xl border border-white/[0.07] bg-white">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={localize(item.productName, language)}
                    className="size-full object-contain"
                  />
                ) : (
                  <Package aria-hidden className="size-4.5 text-neutral-400" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {localize(item.productName, language)}
                </p>
                <p className="text-xs text-neutral-500">
                  {t("track.qty", { count: item.quantity })}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums">
                <Money amount={item.unitPrice * item.quantity} prefixClassName={MONEY_PREFIX_CLASS} />
              </p>
            </li>
          ))}
        </ul>
        <div className="space-y-1.5 border-t border-white/[0.07] pt-4 text-sm">
          <div className="flex justify-between text-neutral-400">
            <span>{t("cart.subtotal")}</span>
            <span className="tabular-nums">
              <Money amount={order.subtotal} prefixClassName={MONEY_PREFIX_CLASS} />
            </span>
          </div>
          <div className="flex justify-between text-neutral-400">
            <span>{t("checkout.deliveryFee")}</span>
            <span className="tabular-nums">
              {order.deliveryFee === 0 ? (
                t("checkout.free")
              ) : (
                <Money amount={order.deliveryFee} prefixClassName={MONEY_PREFIX_CLASS} />
              )}
            </span>
          </div>
          <div className="flex justify-between pt-1 text-[17px] font-extrabold text-white">
            <span>{t("checkout.total")}</span>
            <span className="tabular-nums">
              <Money amount={order.total} prefixClassName={MONEY_PREFIX_CLASS} />
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-[13px] border border-white/[0.07] bg-white/[0.03] p-4">
        <Truck aria-hidden className="size-5 shrink-0 text-sky-500" />
        <div className="text-sm">
          <p className="font-semibold text-white">
            {t(isDelivery ? "track.order.deliveryMethod.delivery" : "track.order.deliveryMethod.pickup")}
          </p>
          {isDelivery && order.address && <p className="text-neutral-400">{order.address}</p>}
          {!isDelivery && (
            <p className="text-neutral-400">{t("track.order.deliveryMethod.collectNote")}</p>
          )}
          <p className="text-neutral-500">{t("track.order.deliveryMethod.cashNote")}</p>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onTrackAnother}
        className="h-11 w-full rounded-[13px] text-neutral-400 hover:bg-white/[0.05] hover:text-white"
      >
        {t("track.trackAnother")}
      </Button>
    </div>
  );
}

function MessageResultPanel({
  inquiry,
  language,
  t,
  onTrackAnother,
}: {
  inquiry: LookupInquiry;
  language: string;
  t: TFunction;
  onTrackAnother: () => void;
}) {
  const isClosed = inquiry.status === InquiryStatus.CLOSED;
  const isResolved = inquiry.status === InquiryStatus.RESOLVED;
  const hasReply = inquiry.messages.some((m) => m.sender !== MessageSender.CUSTOMER);

  // "Last true wins" rather than assuming strict monotonic progression —
  // robust even if a message thread's real state doesn't perfectly line up
  // (e.g. closed without ever being formally "assigned").
  const reached = [true, inquiry.assigned, hasReply, isClosed];
  let currentIndex = 0;
  reached.forEach((value, index) => {
    if (value) currentIndex = index;
  });

  const messageDate = new Date(inquiry.createdAt).toLocaleDateString(language, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="space-y-6 rounded-[20px] border border-white/[0.07] bg-white/[0.032] p-6 backdrop-blur-xl reduced-transparency:bg-neutral-950 reduced-transparency:backdrop-blur-none">
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            {t("track.message.messageLabel")}
          </p>
          <p className="text-[22px] font-extrabold tracking-[0.06em]">{inquiry.code}</p>
          <p className="text-sm text-neutral-400">
            {inquiry.customerName ? `${inquiry.customerName} · ` : ""}
            {messageDate}
          </p>
        </div>
        <StatusChip
          label={t(MESSAGE_STATUS_LABEL_KEYS[inquiry.status])}
          tone={isClosed ? "gray" : isResolved ? "sky" : "amber"}
        />
      </div>

      <Timeline
        language={language}
        currentIndex={currentIndex}
        steps={MESSAGE_STEPS.map((step, index) => ({
          key: step,
          label: t(MESSAGE_TIMELINE_LABEL_KEYS[step]),
          timestamp: index === 0 ? inquiry.createdAt : null,
        }))}
      />

      <div className="space-y-3 border-t border-white/[0.07] pt-5">
        {inquiry.messages.map((message) => {
          const isCustomer = message.sender === MessageSender.CUSTOMER;
          return (
            <div key={message.id} className={cn("flex flex-col gap-1", isCustomer ? "items-start" : "items-end")}>
              <p className="text-[11px] text-neutral-500">
                {isCustomer ? t("track.message.you") : t("track.message.team")}
                {" · "}
                {new Date(message.createdAt).toLocaleString(language, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap",
                  isCustomer
                    ? "rounded-bl-[5px] border border-white/[0.07] bg-white/[0.045] text-neutral-200"
                    : "rounded-br-[5px] border border-sky-500/[0.26] bg-sky-500/[0.11] text-white",
                )}
              >
                {message.body}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onTrackAnother}
        className="h-11 w-full rounded-[13px] text-neutral-400 hover:bg-white/[0.05] hover:text-white"
      >
        {t("track.trackAnother")}
      </Button>
    </div>
  );
}
