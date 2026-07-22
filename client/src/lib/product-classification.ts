import axios from "axios";
import type { ProductClassificationField } from "@es-market/core";

// Fire-and-forget: feeds the dashboard's suggestion-acceptance rate. Never
// blocks or surfaces an error to the UI — a failed ping just under-counts.
// Shared by ProductForm.tsx's per-product panel and the products table's
// bulk-reclassify quick-apply popover.
export function pingClassificationAccepted(field: ProductClassificationField) {
  axios.post("/api/ai/classify-product/accept", { field }).catch(() => {});
}
