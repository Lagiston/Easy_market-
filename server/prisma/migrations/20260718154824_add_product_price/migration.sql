-- AlterTable
-- Backfill existing rows to 0, then drop the default so future inserts must supply a price.
ALTER TABLE "product" ADD COLUMN "price" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "product" ALTER COLUMN "price" DROP DEFAULT;
