-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'PREFER_NOT_TO_SAY');

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "mobile" VARCHAR(20),
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "region" VARCHAR(100);
