-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WEBSHOP', 'ORDER_FORM');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'REQUESTED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'WEBSHOP',
ADD COLUMN     "customerNote" TEXT,
ALTER COLUMN "stripeSessionId" DROP NOT NULL,
ALTER COLUMN "shippingAddress" DROP NOT NULL,
ALTER COLUMN "totalAmount" DROP NOT NULL;

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "unitPriceHuf" DROP NOT NULL,
ALTER COLUMN "printFeeHuf" DROP NOT NULL,
ALTER COLUMN "printFeeHuf" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FeaturedMalfiniProduct" (
    "productCode" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "FeaturedMalfiniProduct_pkey" PRIMARY KEY ("productCode")
);

-- CreateTable
CREATE TABLE "OrderAttachment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderAttachment_storagePath_key" ON "OrderAttachment"("storagePath");

-- CreateIndex
CREATE INDEX "OrderAttachment_orderId_idx" ON "OrderAttachment"("orderId");

-- AddForeignKey
ALTER TABLE "OrderAttachment" ADD CONSTRAINT "OrderAttachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the featured list with the products the designer picker offered when it was
-- hardcoded (DESIGNER_PRODUCT_CODES): Basic tee men/women/kids (129/134/138), Zero +
-- Break sweatshirts (P41/840), Joy polo men/women (P21/P22). Admin-editable afterwards.
INSERT INTO "FeaturedMalfiniProduct" ("productCode", "position") VALUES
    ('129', 0),
    ('134', 1),
    ('138', 2),
    ('P41', 3),
    ('840', 4),
    ('P21', 5),
    ('P22', 6);
