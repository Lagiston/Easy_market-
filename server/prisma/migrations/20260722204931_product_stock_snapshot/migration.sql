-- CreateTable
CREATE TABLE "product_stock_snapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "soldOutCount" INTEGER NOT NULL,
    "soldOutProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "product_stock_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_stock_snapshot_date_key" ON "product_stock_snapshot"("date");
