import type { InquiryStatus } from "@es-market/core";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  OPEN: "Open",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

// Color semantics: unhandled/needs-action is amber, resolved/good is
// emerald, neutral/terminal is gray — an unhandled OPEN inquiry must never
// render in the same green used for a resolved one, or it reads as "already
// handled" (found live: OPEN previously used the brand-primary green
// variant). Applied via className (not Badge's `variant` prop) so the exact
// amber/emerald/gray tones are independent of the theme's `--primary`.
export const INQUIRY_STATUS_TONE_CLASS: Record<InquiryStatus, string> = {
  OPEN: "border-amber-500/30 bg-amber-500/[0.14] text-amber-700 dark:text-amber-400",
  RESOLVED:
    "border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400",
  CLOSED: "border-foreground/15 bg-foreground/5 text-muted-foreground",
};

export default function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <Badge variant="outline" className={cn(INQUIRY_STATUS_TONE_CLASS[status])}>
      {INQUIRY_STATUS_LABELS[status]}
    </Badge>
  );
}
