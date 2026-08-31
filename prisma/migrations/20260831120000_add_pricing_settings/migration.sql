-- CreateTable
CREATE TABLE "PricingSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingSetting_pkey" PRIMARY KEY ("key")
);
