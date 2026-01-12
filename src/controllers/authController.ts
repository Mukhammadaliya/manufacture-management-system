import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticationError, NotFoundError } from '../utils/errors';
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