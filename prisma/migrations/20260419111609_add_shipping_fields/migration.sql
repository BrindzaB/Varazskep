-- CreateEnum
CREATE TYPE "ShippingMethod" AS ENUM ('FOXPOST_LOCKER', 'MPL_HOME_DELIVERY');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "pickupPointAddress" TEXT,
ADD COLUMN     "pickupPointId" TEXT,
ADD COLUMN     "pickupPointName" TEXT,
ADD COLUMN     "shippingCost" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingMethod" "ShippingMethod" NOT NULL DEFAULT 'MPL_HOME_DELIVERY';
