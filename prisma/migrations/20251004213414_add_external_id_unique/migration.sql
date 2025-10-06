/*
  Warnings:

  - A unique constraint covering the columns `[externalId]` on the table `orders` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "orders_externalId_key" ON "orders"("externalId");
