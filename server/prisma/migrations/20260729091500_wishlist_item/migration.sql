-- CreateTable
CREATE TABLE "wishlist_item" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_item_customerId_productId_key" ON "wishlist_item"("customerId", "productId");

-- CreateIndex
CREATE INDEX "wishlist_item_productId_idx" ON "wishlist_item"("productId");

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
