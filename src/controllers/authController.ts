import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { NotFoundError, 
         ValidationError, 
         AuthenticationError,
         AuthorizationError } from '../utils/errors';
import { generateToken } from '../utils/jwt';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Telegram ID orqali login
export const loginWithTelegram = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { telegramId } = req.body;

    if (!telegramId) {
      throw new AuthenticationError('Telegram ID talab qilinadi');
    }

    // Foydalanuvchini topish
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: {
        id: true,
        telegramId: true,
        role: true,
        name: true,
        phone: true,
        companyName: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new NotFoundError('Foydalanuvchi topilmadi');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Foydalanuvchi faol emas');
    }

    // JWT token yaratish
    const token = generateToken({
      userId: user.id,
      telegramId: user.telegramId.toString(),
      role: user.role,
    });

    logger.info(`User logged in: ${user.name} (${user.telegramId})`);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          telegramId: user.telegramId.toString(),
          role: user.role,
          name: user.name,
          phone: user.phone,
          companyName: user.companyName,
        },
      },
    });
  }
);

// Joriy foydalanuvchi ma'lumotlarini olish
export const getCurrentUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AuthenticationError('Autentifikatsiya talab qilinadi');
    }

    res.json({
      success: true,
      data: {
        user: {
          id: req.user.id,
          telegramId: req.user.telegramId.toString(),
          role: req.user.role,
          name: req.user.name,
        },
      },
    });
  }
);

// Pending userlarni olish (Admin/Producer)
export const getPendingUsers = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user!;

    // Faqat Admin va Producer pending userlarni ko'ra oladi
    if (user.role !== 'ADMIN' && user.role !== 'PRODUCER') {
      throw new AuthorizationError('Bu funksiyaga ruxsat yo\'q');
    }

    const pendingUsers = await prisma.user.findMany({
      where: { isActive: false },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        users: pendingUsers,
        count: pendingUsers.length,
      },
    });
  }
);

// Userni tasdiqlash (Admin/Producer)
export const approveUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user!;

    // Faqat Admin va Producer tasdiqlashi mumkin
    if (user.role !== 'ADMIN' && user.role !== 'PRODUCER') {
      throw new AuthorizationError('Bu funksiyaga ruxsat yo\'q');
    }

    const pendingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!pendingUser) {
      throw new NotFoundError('Foydalanuvchi topilmadi');
    }

    if (pendingUser.isActive) {
      throw new ValidationError('Foydalanuvchi allaqachon faol');
    }

    // Userni faollashtirish
    const approvedUser = await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    logger.info(`User approved: ${approvedUser.telegramId} by ${user.name}`);

    res.json({
      success: true,
      data: { user: approvedUser },
      message: 'Foydalanuvchi tasdiqlandi',
    });
  }
);

// Userni rad etish (Admin/Producer)
export const rejectUser = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user!;

    // Faqat Admin va Producer rad etishi mumkin
    if (user.role !== 'ADMIN' && user.role !== 'PRODUCER') {
      throw new AuthorizationError('Bu funksiyaga ruxsat yo\'q');
    }

    const pendingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!pendingUser) {
      throw new NotFoundError('Foydalanuvchi topilmadi');
    }

    // Userni o'chirish
    await prisma.user.delete({
      where: { id },
    });

    logger.info(`User rejected: ${pendingUser.telegramId} by ${user.name}`);

    res.json({
      success: true,
      message: 'Foydalanuvchi rad etildi',
    });
  }
);