-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('PRIVATE', 'COMPANY');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "billingAddress" JSONB,
ADD COLUMN     "billingName" TEXT,
ADD COLUMN     "billingTaxNumber" TEXT,
ADD COLUMN     "billingType" "BillingType";
