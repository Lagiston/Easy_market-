// Tanzanian Shilling display — no shared money-formatting utility existed
// before this; every price site in this codebase was previously a bare
// number, or (on two storefront pages) hardcoded the wrong "KSh" (Kenyan
// Shilling) label. All prices are whole-number Ints (no cents anywhere).
export function formatCurrencyValue(amount: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(amount);
}

// `prefixClassName` defaults to the theme-token `text-muted-foreground` —
// correct on every normal light/dark-toggle page. Pages that force a
// permanently-dark shell regardless of the site's theme (TrackPage.tsx,
// ContactPage.tsx, and this page's own CheckoutPage.tsx rebuild) must pass
// an explicit literal override (e.g. `text-neutral-500`), since the token
// would resolve to a light-mode color that's illegible against a
// hardcoded dark background.
export function Money({
  amount,
  className,
  prefixClassName,
}: {
  amount: number;
  className?: string;
  prefixClassName?: string;
}) {
  return (
    <span className={className}>
      <span className={prefixClassName ?? "text-[0.66em] font-semibold text-muted-foreground"}>
        TSh{" "}
      </span>
      <span className="tabular-nums">{formatCurrencyValue(amount)}</span>
    </span>
  );
}
