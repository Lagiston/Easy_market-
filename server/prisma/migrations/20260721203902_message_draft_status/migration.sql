-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'SENT_UNEDITED', 'SENT_EDITED', 'DISCARDED');

-- AlterTable
ALTER TABLE "message" ADD COLUMN "draftStatus" "DraftStatus";
