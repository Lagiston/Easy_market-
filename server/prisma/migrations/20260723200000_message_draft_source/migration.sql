-- AlterTable
ALTER TABLE "message" ADD COLUMN "sourceDraftMessageId" TEXT;

-- AddForeignKey
ALTER TABLE "message" ADD CONSTRAINT "message_sourceDraftMessageId_fkey" FOREIGN KEY ("sourceDraftMessageId") REFERENCES "message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
