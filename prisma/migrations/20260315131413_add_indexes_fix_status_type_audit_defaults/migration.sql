/*
  Warnings:

  - Changed the type of `status` on the `order_status_history` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "order_items" ALTER COLUMN "created_by" SET DEFAULT 'SYSTEM',
ALTER COLUMN "updated_by" SET DEFAULT 'SYSTEM';

-- AlterTable
ALTER TABLE "order_status_history" DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL;

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "created_by" SET DEFAULT 'SYSTEM',
ALTER COLUMN "updated_by" SET DEFAULT 'SYSTEM';

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_changed_by_idx" ON "order_status_history"("changed_by");

-- CreateIndex
CREATE INDEX "orders_distributor_id_idx" ON "orders"("distributor_id");
