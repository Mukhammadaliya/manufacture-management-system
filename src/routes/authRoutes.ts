import { Router } from 'express';
import { 
  loginWithTelegram, 
  getCurrentUser,
  getPendingUsers,
  approveUser,
  rejectUser
} from '../controllers/authController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// POST /api/auth/login - Telegram ID bilan login
router.post('/login', loginWithTelegram);

// GET /api/auth/me - Joriy foydalanuvchi
router.get('/me', authenticate, getCurrentUser);

// GET /api/auth/pending - Pending userlar (Admin/Producer)
router.get('/pending', authenticate, authorize('ADMIN', 'PRODUCER'), getPendingUsers);

// PATCH /api/auth/approve/:id - Userni tasdiqlash (Admin/Producer)
router.patch('/approve/:id', authenticate, authorize('ADMIN', 'PRODUCER'), approveUser);

// DELETE /api/auth/reject/:id - Userni rad etish (Admin/Producer)
router.delete('/reject/:id', authenticate, authorize('ADMIN', 'PRODUCER'), rejectUser);

export default router;