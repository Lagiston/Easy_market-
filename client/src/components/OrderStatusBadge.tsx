import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import type { CancelReason, OrderStatus } from "@es-market/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function getOrderStatusLabel(t: TFunction, status: OrderStatus): string {
  return t(`admin.orderStatus.${status}`);
}

export function getCancelReasonLabel(t: TFunction, reason: CancelReason): string {
  return t(`admin.cancelReason.${reason}`);
}

// Color semantics: unhandled/needs-action (RECEIVED, awaiting the
// confirmation call) is amber; a confirmed/completed order is emerald;
// out-for-delivery is neutral/informational (in progress, nothing for staff
// to do right now); cancelled stays a distinct red/bad tone. Applied via
// className (not Badge's `variant` prop) so the exact tones are independent
// of the theme's `--primary`/`--destructive` — see InquiryStatusBadge for
// the same convention and the live bug this pattern was introduced to fix.
export const ORDER_STATUS_TONE_CLASS: Record<OrderStatus, string> = {
  RECEIVED: "border-amber-500/30 bg-amber-500/[0.14] text-amber-700 dark:text-amber-400",
  CONFIRMED:
    "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400",
  OUT_FOR_DELIVERY: "border-foreground/15 bg-foreground/5 text-muted-foreground",
  COMPLETED:
    "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400",
  CANCELLED: "border-red-500/30 bg-red-500/[0.14] text-red-700 dark:text-red-400",
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn(ORDER_STATUS_TONE_CLASS[status])}>
      {getOrderStatusLabel(t, status)}
    </Badge>
  );
}
