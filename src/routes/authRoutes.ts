import { Router } from 'express';
import { loginWithTelegram, getCurrentUser } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// POST /api/auth/login - Telegram ID bilan login
router.post('/login', loginWithTelegram);

// GET /api/auth/me - Joriy foydalanuvchi
router.get('/me', authenticate, getCurrentUser);

export default router;