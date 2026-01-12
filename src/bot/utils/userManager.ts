import { PrismaClient, UserRole } from '@prisma/client';
import logger from '../../utils/logger';

const prisma = new PrismaClient();

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

// Foydalanuvchini topish yoki yaratish
export const findOrCreateUser = async (telegramUser: TelegramUser) => {
  try {
    const telegramId = BigInt(telegramUser.id);

    // Foydalanuvchini topish
    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    // Agar yo'q bo'lsa, yangi yaratish (default: DISTRIBUTOR)
    if (!user) {
      const name = `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim();

      user = await prisma.user.create({
        data: {
          telegramId,
          role: UserRole.DISTRIBUTOR,
          name,
          isActive: false, // Admin tasdiqlaguncha faol emas
        },
      });

      logger.info(`New user registered: ${name} (${telegramId})`);
    }

    return user;
  } catch (error) {
    logger.error('Error in findOrCreateUser:', error);
    return null;
  }
};

// Foydalanuvchi faolligini tekshirish
export const isUserActive = async (telegramId: number) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    return user?.isActive || false;
  } catch (error) {
    logger.error('Error checking user active status:', error);
    return false;
  }
};

// Foydalanuvchi rolini olish
export const getUserRole = async (telegramId: number) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { role: true },
    });

    return user?.role || null;
  } catch (error) {
    logger.error('Error getting user role:', error);
    return null;
  }
};

// Foydalanuvchi ma'lumotlarini olish
export const getUserInfo = async (telegramId: number) => {
  try {
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

    return user;
  } catch (error) {
    logger.error('Error getting user info:', error);
    return null;
  }
};