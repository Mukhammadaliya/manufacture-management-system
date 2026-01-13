import { PrismaClient, UserRole } from '@prisma/client';
import logger from '../../utils/logger';

const prisma = new PrismaClient();

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
}

// Foydalanuvchini topish (yaratmaslik)
export const findUser = async (telegramId: number) => {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
    return user;
  } catch (error) {
    logger.error('Error in findUser:', error);
    return null;
  }
};

// Yangi foydalanuvchi yaratish (isActive = false)
export const createUser = async (
  telegramUser: TelegramUser,
  role: UserRole,
  additionalData: {
    phone?: string;
    companyName?: string;
  }
) => {
  try {
    const name = `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim();

    const user = await prisma.user.create({
      data: {
        telegramId: BigInt(telegramUser.id),
        role: role,
        name: name,
        phone: additionalData.phone,
        companyName: additionalData.companyName,
        isActive: false, // Admin tasdiqlashi kerak
      },
    });

    logger.info(`New user registered: ${name} (${telegramUser.id}) - Role: ${role}`);
    return user;
  } catch (error) {
    logger.error('Error in createUser:', error);
    return null;
  }
};

// Legacy function - backward compatibility
export const findOrCreateUser = async (telegramUser: TelegramUser) => {
  const user = await findUser(telegramUser.id);
  return user;
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