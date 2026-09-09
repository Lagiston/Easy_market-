export const NEW_BADGE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type ProductBadgeKind = "soldOut" | "onSale" | "new" | null;

// Priority when multiple could apply: out-of-stock > on-sale > new — only one
// badge ever shows. Just the decision itself is shared: the desktop product
// grid (ProductsPage), the mobile grid card (ProductCard), and the product
// detail gallery (ProductDetailPage) each still compute their own
// isSoldOut/isOnSale/isNew (they don't all derive "sold out" the same way —
// ProductCard checks stock directly, the other two go through
// getStockStatus) and render their own Badge JSX/styling for the winner.
export function getProductBadgeKind({
  isSoldOut,
  isOnSale,
  isNew,
}: {
  isSoldOut: boolean;
  isOnSale: boolean;
  isNew: boolean;
}): ProductBadgeKind {
  if (isSoldOut) return "soldOut";
  if (isOnSale) return "onSale";
  if (isNew) return "new";
  return null;
}
