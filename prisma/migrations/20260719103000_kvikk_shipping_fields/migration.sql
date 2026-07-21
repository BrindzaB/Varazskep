-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('HOME_DELIVERY', 'DELIVERY_POINT');

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNED';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "courierTrackingNumber" TEXT,
ADD COLUMN     "deliveryPointId" TEXT,
ADD COLUMN     "deliveryPointType" TEXT,
ADD COLUMN     "deliveryType" "DeliveryType",
ADD COLUMN     "kvikkShipmentId" TEXT,
ADD COLUMN     "kvikkTrackingNumber" TEXT,
ADD COLUMN     "shippingCourier" TEXT;

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "weightGrams" INTEGER;
