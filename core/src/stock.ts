// Single source of truth for the in-stock/low-stock/out-of-stock thresholds —
// admin (client/src/components/ProductsTable.tsx) and storefront
// (client/src/pages/storefront/ProductsPage.tsx) each render this with their
// own naming/i18n keys, but both must agree on the same stock <
// lowStockThreshold boundary the dashboard's low-stock count also uses
// (server/src/routes/dashboard.ts).
export type StockLevel = "out" | "low" | "in";

export function classifyStock(product: { stock: number; lowStockThreshold: number }): StockLevel {
  if (product.stock === 0) return "out";
  if (product.stock < product.lowStockThreshold) return "low";
  return "in";
}
