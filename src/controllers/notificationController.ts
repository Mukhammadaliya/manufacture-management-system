import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { NotFoundError, AuthorizationError } from '../utils/errors';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Foydalanuvchining barcha xabarnomalarini olish
export const getUserNotifications = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;
    const { isRead, limit = 50 } = req.query;

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(isRead !== undefined && { isRead: isRead === 'true' }),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: user.id,
        isRead: false,
      },
    });

    res.json({
      success: true,
      data: {
        notifications,
        count: notifications.length,
        unreadCount,
      },
    });
  }
);

// Bitta xabarnomani olish
export const getNotificationById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user!;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundError('Xabarnoma topilmadi');
    }

    // Foydalanuvchi faqat o'z xabarnomalarini ko'ra oladi
    if (notification.userId !== user.id) {
      throw new AuthorizationError('Bu xabarnomani ko\'rishga ruxsatingiz yo\'q');
    }

    res.json({
      success: true,
      data: { notification },
    });
  }
);

// Xabarnomani o'qilgan qilish
export const markAsRead = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user!;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundError('Xabarnoma topilmadi');
    }

    if (notification.userId !== user.id) {
      throw new AuthorizationError('Bu xabarnomani o\'qilgan qilishga ruxsatingiz yo\'q');
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      success: true,
      data: { notification: updatedNotification },
      message: 'Xabarnoma o\'qilgan qilib belgilandi',
    });
  }
);

// Barcha xabarnomalarni o'qilgan qilish
export const markAllAsRead = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;

    const result = await prisma.notification.updateMany({
      where: {
        userId: user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    logger.info(`User ${user.name} marked ${result.count} notifications as read`);

    res.json({
      success: true,
      data: { count: result.count },
      message: 'Barcha xabarnomalar o\'qilgan qilib belgilandi',
    });
  }
);

// Xabarnomani o'chirish
export const deleteNotification = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user!;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundError('Xabarnoma topilmadi');
    }

    if (notification.userId !== user.id) {
      throw new AuthorizationError('Bu xabarnomani o\'chirishga ruxsatingiz yo\'q');
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Xabarnoma muvaffaqiyatli o\'chirildi',
    });
  }
);

// Barcha xabarnomalarni o'chirish
export const deleteAllNotifications = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;

    const result = await prisma.notification.deleteMany({
      where: { userId: user.id },
    });

    logger.info(`User ${user.name} deleted ${result.count} notifications`);

    res.json({
      success: true,
      data: { count: result.count },
      message: 'Barcha xabarnomalar o\'chirildi',
    });
  }
);