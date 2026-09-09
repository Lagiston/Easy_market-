import { cn } from "@/lib/utils";

// Shared one-line "nothing to show" text for a storefront list/detail page's
// error or empty state — the loading skeleton itself stays page-specific
// (each page's skeleton shape differs too much to share), but this single
// paragraph was copy-pasted identically across ProductsPage, ProductDetailPage,
// AccountWishlistPage, and AccountOrdersPage.
export function StorefrontStatusMessage({
  variant = "muted",
  children,
}: {
  variant?: "muted" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "py-12 text-center text-sm",
        variant === "destructive" ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {children}
    </p>
  );
}
