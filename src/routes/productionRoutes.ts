import { Router } from 'express';
import {
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch,
  getDailySummary,
} from '../controllers/productionController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// GET /api/production/batches - Barcha partiyalar
router.get('/batches', authenticate, authorize('ADMIN', 'PRODUCER'), getAllBatches);

// GET /api/production/batches/:id - Bitta partiya
router.get('/batches/:id', authenticate, authorize('ADMIN', 'PRODUCER'), getBatchById);

// POST /api/production/batches - Yangi partiya
router.post('/batches', authenticate, authorize('ADMIN', 'PRODUCER'), createBatch);

// PUT /api/production/batches/:id - Partiyani yangilash
router.put('/batches/:id', authenticate, authorize('ADMIN', 'PRODUCER'), updateBatch);

// GET /api/production/summary - Kunlik umumiy hisobot
router.get('/summary', authenticate, authorize('ADMIN', 'PRODUCER'), getDailySummary);

export default router;