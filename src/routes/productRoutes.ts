import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/productController';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createProductSchema } from '../utils/validators';

const router = Router();

// GET /api/products - Barcha mahsulotlar
router.get('/', authenticate, getAllProducts);

// GET /api/products/:id - Bitta mahsulot
router.get('/:id', authenticate, getProductById);

// POST /api/products - Yangi mahsulot (faqat admin)
router.post(
  '/',
  authenticate,
  authorize('ADMIN'),
  validate(createProductSchema),
  createProduct
);

// PUT /api/products/:id - Mahsulotni yangilash (faqat admin)
router.put(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  updateProduct
);

// DELETE /api/products/:id - Mahsulotni o'chirish (faqat admin)
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  deleteProduct
);

export default router;