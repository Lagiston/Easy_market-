import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

// Read-only 5-star row — used both for an individual review's own 1-5 rating
// and (rounded) for an average-rating summary. Renders as a labeled
// <span role="img"> by default; pass no `label` when an enclosing element
// already carries the equivalent aria-label (e.g. ProductDetailPage's main
// rating line), so the row itself renders aria-hidden instead of announcing
// a second, redundant (or empty) accessible name. Not a set of buttons — see
// RatingPicker in ProductReviews.tsx for the interactive star-button widget
// used by the write-a-review form.
export function StarRow({
  rating,
  label,
  className,
}: {
  rating: number;
  label?: string;
  className?: string;
}) {
  const a11yProps = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true };
  return (
    <span {...a11yProps} className={cn("inline-flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(
            "size-4",
            star <= rating ? "fill-[#facc15] text-[#facc15]" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

// Compact "★ 4.5 (12)" summary shown on a product card or related-product
// tile — a single star icon, unlike StarRow's full 5-star spread.
// `starClassName` lets a caller override the star's color (e.g. the related-
// products list on ProductDetailPage uses sky-500 instead of the default
// yellow) without needing a second component.
export function AverageRatingBadge({
  average,
  count,
  label,
  className,
  starClassName,
}: {
  average: number;
  count: number;
  label: string;
  className?: string;
  starClassName?: string;
}) {
  return (
    <span aria-label={label} className={cn("flex items-center gap-1", className)}>
      <Star aria-hidden className={cn("size-3.5 fill-[#facc15] text-[#facc15]", starClassName)} />
      <span aria-hidden>
        {average.toFixed(1)} ({count})
      </span>
    </span>
  );
}
