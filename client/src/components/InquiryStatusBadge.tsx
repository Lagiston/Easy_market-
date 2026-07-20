import type { InquiryStatus } from "@es-market/core";
import { Badge } from "@/components/ui/badge";

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const STATUS_VARIANTS: Record<InquiryStatus, "default" | "secondary" | "outline"> = {
  OPEN: "default",
  RESOLVED: "secondary",
  CLOSED: "outline",
};

export default function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]}>{INQUIRY_STATUS_LABELS[status]}</Badge>;
}
