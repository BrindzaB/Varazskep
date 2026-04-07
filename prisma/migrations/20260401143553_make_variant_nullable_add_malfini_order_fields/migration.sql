-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_variantId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "colorName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "productCode" TEXT,
ADD COLUMN     "productName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "productSizeCode" TEXT,
ADD COLUMN     "sizeName" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "variantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
