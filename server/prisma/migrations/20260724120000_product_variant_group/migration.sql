-- Groups products that are variants of the same item (e.g. different
-- colors) so the storefront can cross-link them.
ALTER TABLE "product" ADD COLUMN "variantGroupId" TEXT;

CREATE INDEX "product_variantGroupId_idx" ON "product"("variantGroupId");
