import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthenticationError, AuthorizationError } from '../utils/errors';

const prisma = new PrismaClient();

// JWT token'dan foydalanuvchi ma'lumotlarini olish
interface JwtPayload {
  userId: string;
  telegramId: string;
  role: string;
}

// Request'ga user qo'shish uchun type extension
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        telegramId: bigint;
        role: string;
        name: string;
      };
    }
  }
}

// JWT token tekshirish
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Header'dan token olish
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Token topilmadi');
    }

    const token = authHeader.split(' ')[1];

    // Token'ni verify qilish
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default_secret'
    ) as JwtPayload;

    // Foydalanuvchini database'dan olish
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        telegramId: true,
        role: true,
        name: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('Foydalanuvchi topilmadi');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Foydalanuvchi faol emas');
    }

    // User'ni request'ga qo'shish
    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('Noto\'g\'ri token'));
    } else if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('Token muddati tugagan'));
    } else {
      next(error);
    }
  }
};

// Telegram ID orqali autentifikatsiya (Bot uchun)
export const authenticateTelegram = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const telegramId = req.body.telegramId || req.query.telegramId;

    if (!telegramId) {
      throw new AuthenticationError('Telegram ID topilmadi');
    }

    // Foydalanuvchini topish
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: {
        id: true,
        telegramId: true,
        role: true,
        name: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('Foydalanuvchi topilmadi');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Foydalanuvchi faol emas');
    }

    // User'ni request'ga qo'shish
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

// Role tekshirish
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('Autentifikatsiya talab qilinadi'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AuthorizationError('Sizda bu amalni bajarish uchun ruxsat yo\'q')
      );
    }

    next();
  };
};