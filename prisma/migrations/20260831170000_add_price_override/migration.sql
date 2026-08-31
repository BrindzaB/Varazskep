-- CreateTable
CREATE TABLE "PriceOverride" (
    "productSizeCode" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "priceHuf" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceOverride_pkey" PRIMARY KEY ("productSizeCode")
);

-- CreateIndex
CREATE INDEX "PriceOverride_productCode_idx" ON "PriceOverride"("productCode");
