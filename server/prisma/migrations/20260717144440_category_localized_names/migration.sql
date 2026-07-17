-- Convert Category.name from plain text to per-language JSON ({ en, ar?, sw?, fr? }).
-- Existing values are wrapped as the English translation. Drop the unique index on the
-- old text column (uniqueness on the localized name is now enforced at the app layer)
-- and add soft-delete support, matching Product/User.
ALTER TABLE "category" DROP CONSTRAINT IF EXISTS "category_name_key";

ALTER TABLE "category"
  ALTER COLUMN "name" TYPE JSONB USING jsonb_build_object('en', "name"),
  ADD COLUMN "deletedAt" TIMESTAMP(3);
