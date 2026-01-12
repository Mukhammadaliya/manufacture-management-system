import { Router } from 'express';
import {
  getUserNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/notifications - Foydalanuvchining xabarnomalarini olish
router.get('/', authenticate, getUserNotifications);

// GET /api/notifications/:id - Bitta xabarnoma
router.get('/:id', authenticate, getNotificationById);

// PATCH /api/notifications/:id/read - Xabarnomani o'qilgan qilish
router.patch('/:id/read', authenticate, markAsRead);

// PATCH /api/notifications/read-all - Barchasini o'qilgan qilish
router.patch('/read-all', authenticate, markAllAsRead);

// DELETE /api/notifications/:id - Xabarnomani o'chirish
router.delete('/:id', authenticate, deleteNotification);

// DELETE /api/notifications - Barchasini o'chirish
router.delete('/', authenticate, deleteAllNotifications);

export default router;