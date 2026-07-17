-- Convert Product.name/description from plain text to per-language JSON ({ en, ar?, sw?, fr? }).
-- Existing values are wrapped as the English translation.
ALTER TABLE "product"
  ALTER COLUMN "name" TYPE JSONB USING jsonb_build_object('en', "name"),
  ALTER COLUMN "description" TYPE JSONB USING (
    CASE WHEN "description" IS NULL THEN NULL ELSE jsonb_build_object('en', "description") END
  );
