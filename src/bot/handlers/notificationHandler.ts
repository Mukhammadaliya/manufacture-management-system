import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';

const prisma = new PrismaClient();

// Foydalanuvchining xabarnomalarini ko'rish
export const viewNotifications = async (
  bot: TelegramBot,
  chatId: number,
  userId: string
) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // Oxirgi 10 ta xabarnoma
    });

    if (notifications.length === 0) {
      bot.sendMessage(chatId, '🔔 Sizda yangi xabarnomalar yo\'q.');
      return;
    }

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    let message = `🔔 Xabarnomalar (${unreadCount} ta o'qilmagan):\n\n`;

    const typeEmoji: { [key: string]: string } = {
      ORDER_STATUS: '📊',
      ORDER_CHANGE: '📝',
      PRODUCTION_UPDATE: '🔨',
      SYSTEM: '⚙️',
    };

    notifications.forEach((notif, index) => {
      const emoji = typeEmoji[notif.type] || '📋';
      const readStatus = notif.isRead ? '' : '🔴 ';

      message += `${index + 1}. ${readStatus}${emoji} ${notif.title}\n`;
      message += `   ${notif.message}\n`;
      message += `   📅 ${notif.createdAt.toLocaleDateString()} ${notif.createdAt.toLocaleTimeString()}\n\n`;
    });

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '✅ Barchasini o\'qilgan qilish', callback_data: 'mark_all_read' }],
      [{ text: '🗑 Barchasini o\'chirish', callback_data: 'delete_all_notifications' }],
      [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
    ];

    bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error('Error in viewNotifications:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

// Barcha xabarnomalarni o'qilgan qilish
export const markAllNotificationsRead = async (
  bot: TelegramBot,
  chatId: number,
  userId: string
) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    bot.sendMessage(
      chatId,
      `✅ ${result.count} ta xabarnoma o'qilgan qilib belgilandi.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
          ],
        },
      }
    );

    logger.info(`User marked ${result.count} notifications as read`);
  } catch (error) {
    logger.error('Error in markAllNotificationsRead:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

// Barcha xabarnomalarni o'chirish
export const deleteAllNotifications = async (
  bot: TelegramBot,
  chatId: number,
  userId: string
) => {
  try {
    const result = await prisma.notification.deleteMany({
      where: {
        userId: userId,
      },
    });

    bot.sendMessage(chatId, `🗑 ${result.count} ta xabarnoma o'chirildi.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
        ],
      },
    });

    logger.info(`User deleted ${result.count} notifications`);
  } catch (error) {
    logger.error('Error in deleteAllNotifications:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};