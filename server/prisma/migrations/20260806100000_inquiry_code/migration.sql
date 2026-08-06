-- AlterTable
ALTER TABLE "inquiry" ADD COLUMN "code" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_code_key" ON "inquiry"("code");
