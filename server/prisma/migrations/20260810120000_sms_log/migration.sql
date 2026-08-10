-- CreateEnum
CREATE TYPE "SmsLogStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "sms_log" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SmsLogStatus" NOT NULL,
    "error" TEXT,
    "orderId" TEXT,
    "inquiryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sms_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sms_log_orderId_idx" ON "sms_log"("orderId");

-- CreateIndex
CREATE INDEX "sms_log_inquiryId_idx" ON "sms_log"("inquiryId");

-- AddForeignKey
ALTER TABLE "sms_log" ADD CONSTRAINT "sms_log_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_log" ADD CONSTRAINT "sms_log_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
