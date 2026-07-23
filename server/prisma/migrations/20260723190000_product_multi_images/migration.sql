-- Replace single imageUrl with an ordered images array; migrate existing
-- single-image data into the new column before dropping the old one.
ALTER TABLE "product" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "product" SET "images" = ARRAY["imageUrl"] WHERE "imageUrl" IS NOT NULL;

ALTER TABLE "product" DROP COLUMN "imageUrl";
