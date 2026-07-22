-- CreateTable
CREATE TABLE "product_classification_metric" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "categorySuggested" INTEGER NOT NULL DEFAULT 0,
    "categoryAccepted" INTEGER NOT NULL DEFAULT 0,
    "tagsSuggested" INTEGER NOT NULL DEFAULT 0,
    "tagsAccepted" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_classification_metric_pkey" PRIMARY KEY ("id")
);
