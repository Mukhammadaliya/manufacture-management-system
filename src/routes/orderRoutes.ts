import { Router } from 'express';
import {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  updateOrderItem,
  getOrderItems, 
} from '../controllers/orderController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createOrderSchema, 
  updateOrderStatusSchema,
  updateOrderItemSchema
} from '../utils/validators';

const router = Router();

// GET /api/orders - Barcha buyurtmalar
router.get('/', authenticate, getAllOrders);

// GET /api/orders/:id - Bitta buyurtma
router.get('/:id', authenticate, getOrderById);

// POST /api/orders - Yangi buyurtma
router.post(
  '/',
  authenticate,
  validate(createOrderSchema),
  createOrder
);

// PUT /api/orders/:id - Buyurtmani yangilash
router.put('/:id', authenticate, updateOrder);

// PATCH /api/orders/:id/status - Buyurtma holatini o'zgartirish
router.patch(
  '/:id/status',
  authenticate,
  authorize('ADMIN', 'PRODUCER'),
  validate(updateOrderStatusSchema),
  updateOrderStatus
);

// DELETE /api/orders/:id - Buyurtmani o'chirish
router.delete('/:id', authenticate, deleteOrder);

// GET /api/orders/:orderId/items - Buyurtma item'larini olish
router.get('/:orderId/items', authenticate, getOrderItems);

// PATCH /api/orders/:orderId/items/:itemId - Order item miqdorini o'zgartirish
router.patch(
  '/:orderId/items/:itemId',
  authenticate,
  authorize('ADMIN', 'PRODUCER'),
  validate(updateOrderItemSchema),
  updateOrderItem
);

export default router;