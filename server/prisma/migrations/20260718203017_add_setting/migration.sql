-- CreateTable
CREATE TABLE "setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("key")
);
