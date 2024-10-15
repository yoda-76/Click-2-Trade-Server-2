/*
  Warnings:

  - You are about to drop the column `accountId` on the `OrderBook` table. All the data in the column will be lost.
  - You are about to drop the column `childOrders` on the `OrderBook` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `OrderBook` table. All the data in the column will be lost.
  - You are about to drop the column `orderDetails` on the `OrderBook` table. All the data in the column will be lost.
  - You are about to drop the column `orderId` on the `OrderBook` table. All the data in the column will be lost.
  - You are about to drop the column `accountId` on the `Position` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Position` table. All the data in the column will be lost.
  - You are about to drop the column `positionDetails` on the `Position` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[order_id]` on the table `OrderBook` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `account_id` to the `OrderBook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `child_orders` to the `OrderBook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order_details` to the `OrderBook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `order_id` to the `OrderBook` table without a default value. This is not possible if the table is not empty.
  - Added the required column `account_id` to the `Position` table without a default value. This is not possible if the table is not empty.
  - Added the required column `position_details` to the `Position` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "OrderBook_orderId_key";

-- AlterTable
ALTER TABLE "OrderBook" DROP COLUMN "accountId",
DROP COLUMN "childOrders",
DROP COLUMN "createdAt",
DROP COLUMN "orderDetails",
DROP COLUMN "orderId",
ADD COLUMN     "account_id" TEXT NOT NULL,
ADD COLUMN     "child_orders" JSONB NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "order_details" JSONB NOT NULL,
ADD COLUMN     "order_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Position" DROP COLUMN "accountId",
DROP COLUMN "createdAt",
DROP COLUMN "positionDetails",
ADD COLUMN     "account_id" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "position_details" JSONB NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "OrderBook_order_id_key" ON "OrderBook"("order_id");
