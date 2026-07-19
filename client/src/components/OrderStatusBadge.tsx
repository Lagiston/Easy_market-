import type { CancelReason, OrderStatus } from "@es-market/core";
import { Badge } from "@/components/ui/badge";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  RECEIVED: "Received",
  CONFIRMED: "Confirmed",
  OUT_FOR_DELIVERY: "Out for delivery",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_VARIANTS: Record<OrderStatus, "default" | "secondary" | "outline" | "destructive"> = {
  RECEIVED: "secondary",
  CONFIRMED: "default",
  OUT_FOR_DELIVERY: "outline",
  COMPLETED: "default",
  CANCELLED: "destructive",
};

export const CANCEL_REASON_LABELS: Record<CancelReason, string> = {
  CUSTOMER_UNREACHABLE: "Customer unreachable",
  OUTSIDE_DELIVERY_AREA: "Outside delivery area",
  CUSTOMER_REQUEST: "Customer request",
  OTHER: "Other",
};

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>;
}
