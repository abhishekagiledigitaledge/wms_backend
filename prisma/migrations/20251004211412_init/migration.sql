-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "customerAddress" TEXT,
    "status" TEXT NOT NULL,
    "paymentStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "outlet" TEXT,
    "subtotal" DOUBLE PRECISION,
    "tax" DOUBLE PRECISION,
    "shippingFee" DOUBLE PRECISION,
    "discount" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fulfilledAt" TIMESTAMP(3),
    "extraData" JSONB,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);
