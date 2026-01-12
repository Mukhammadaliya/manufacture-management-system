import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { 
  findOrCreateUser,
  getUserRole,
  getUserInfo
} from './utils/userManager';
import { MESSAGES } from './utils/messages';
import {
  startNewOrder,
  selectProduct,
  enterQuantity,
  confirmOrder,
  cancelOrder,
  enterDate,
  getOrderSession,
  viewMyOrders,
} from './handlers/orderHandler';
import {
  viewNotifications,
  markAllNotificationsRead,
  deleteAllNotifications,
} from './handlers/notificationHandler';
import {
  viewAllOrders,
  getDailySummary,
} from './handlers/producerHandler';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;

if (!token) {
  logger.error('TELEGRAM_BOT_TOKEN topilmadi!');
  process.exit(1);
}

// Bot yaratish
const bot = new TelegramBot(token, { polling: true });

// Bot ishga tushganini log qilish
bot.on('polling_error', (error) => {
  logger.error('Bot polling error:', error);
});

logger.info('🤖 Telegram Bot ishga tushdi!');

// Middleware: Har bir xabar uchun foydalanuvchini tekshirish
const checkUserAccess = async (msg: TelegramBot.Message): Promise<boolean> => {
  const chatId = msg.chat.id;

  if (!msg.from) return false;

  // Foydalanuvchini topish yoki yaratish
  const user = await findOrCreateUser(msg.from);

  if (!user) {
    bot.sendMessage(chatId, MESSAGES.ERROR);
    return false;
  }

  // Faolligini tekshirish
  if (!user.isActive) {
    bot.sendMessage(chatId, MESSAGES.REGISTRATION_PENDING);
    return false;
  }

  return true;
};

// /start buyrug'i
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const firstName = msg.from?.first_name || 'Foydalanuvchi';

  if (!msg.from) return;

  // Foydalanuvchini topish yoki yaratish
  const user = await findOrCreateUser(msg.from);

  if (!user) {
    bot.sendMessage(chatId, MESSAGES.ERROR);
    return;
  }

  // Faolligini tekshirish
  if (!user.isActive) {
    bot.sendMessage(chatId, MESSAGES.REGISTRATION_PENDING);
    return;
  }

  bot.sendMessage(chatId, MESSAGES.WELCOME(firstName), {
    reply_markup: {
      keyboard: [[{ text: '📋 Menyu' }], [{ text: '❓ Yordam' }]],
      resize_keyboard: true,
    },
  });
});

// /menu buyrug'i
bot.onText(/\/menu/, async (msg) => {
  const chatId = msg.chat.id;

  const hasAccess = await checkUserAccess(msg);
  if (!hasAccess) return;

  const role = await getUserRole(msg.from!.id);

  // Role ga qarab menyu ko'rsatish
  if (role === 'DISTRIBUTOR') {
    bot.sendMessage(chatId, 'Asosiy menyu:', {
      reply_markup: {
        keyboard: [
          [{ text: '📦 Yangi buyurtma' }, { text: '📋 Mening buyurtmalarim' }],
          [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
          [{ text: '❓ Yordam' }],
        ],
        resize_keyboard: true,
      },
    });
  } else if (role === 'PRODUCER' || role === 'ADMIN') {
    bot.sendMessage(chatId, 'Admin menyu:', {
      reply_markup: {
        keyboard: [
          [{ text: '📊 Buyurtmalar' }, { text: '🔨 Ishlab chiqarish' }],
          [{ text: '📈 Hisobotlar' }, { text: '👤 Profil' }],
          [{ text: '❓ Yordam' }],
        ],
        resize_keyboard: true,
      },
    });
  }
});

// /help buyrug'i
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  const hasAccess = await checkUserAccess(msg);
  if (!hasAccess) return;

  bot.sendMessage(chatId, MESSAGES.HELP);
});

// Oddiy xabarlar uchun handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Buyruqlarni ignore qilish
  if (text?.startsWith('/')) return;

  const hasAccess = await checkUserAccess(msg);
  if (!hasAccess) return;

  const role = await getUserRole(msg.from!.id);

  // Order session bor-yo'qligini tekshirish
  const session = getOrderSession(chatId);

  // Agar session'da miqdor kiritish kutilayotgan bo'lsa
  if (session && session.step === 'entering_quantity') {
    const quantity = parseFloat(text || '0');
    if (isNaN(quantity) || quantity <= 0) {
      bot.sendMessage(chatId, '❌ Noto\'g\'ri miqdor. Iltimos, musbat son kiriting:');
      return;
    }
    await enterQuantity(bot, chatId, quantity);
    return;
  }

  // Agar session'da sana kiritish kutilayotgan bo'lsa
  if (session && session.step === 'selecting_dates') {
    await enterDate(bot, chatId, text || '');
    return;
  }

  // Keyboard tugmalari
  if (text === '📋 Menyu') {
    if (role === 'DISTRIBUTOR') {
      bot.sendMessage(chatId, 'Asosiy menyu:', {
        reply_markup: {
          keyboard: [
            [{ text: '📦 Yangi buyurtma' }, { text: '📋 Mening buyurtmalarim' }],
            [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
            [{ text: '❓ Yordam' }],
          ],
          resize_keyboard: true,
        },
      });
    } else if (role === 'PRODUCER' || role === 'ADMIN') {
      bot.sendMessage(chatId, 'Admin menyu:', {
        reply_markup: {
          keyboard: [
            [{ text: '📊 Buyurtmalar' }, { text: '🔨 Ishlab chiqarish' }],
            [{ text: '📈 Hisobotlar' }, { text: '👤 Profil' }],
            [{ text: '❓ Yordam' }],
          ],
          resize_keyboard: true,
        },
      });
    }
  } else if (text === '📦 Yangi buyurtma') {
    const userInfo = await getUserInfo(msg.from!.id);
    if (userInfo) {
      await startNewOrder(bot, chatId, userInfo.id);
    }
  } else if (text === '📋 Mening buyurtmalarim') {
    const userInfo = await getUserInfo(msg.from!.id);
    if (userInfo) {
      await viewMyOrders(bot, chatId, userInfo.id);
    }
  } else if (text === '🔔 Xabarnomalar') {
    const userInfo = await getUserInfo(msg.from!.id);
    if (userInfo) {
      await viewNotifications(bot, chatId, userInfo.id);
    }
  } else if (text === '👤 Profil') {
    const userInfo = await getUserInfo(msg.from!.id);
    if (userInfo) {
      bot.sendMessage(
        chatId,
        `👤 Profil Ma'lumotlari

📛 Ism: ${userInfo.name}
🏢 Kompaniya: ${userInfo.companyName || 'Kiritilmagan'}
📞 Telefon: ${userInfo.phone || 'Kiritilmagan'}
👔 Rol: ${userInfo.role}
✅ Status: ${userInfo.isActive ? 'Faol' : 'Faol emas'}`
      );
    }
  } else if (text === '❓ Yordam') {
    bot.sendMessage(chatId, MESSAGES.HELP);
  } else if (text === '📊 Buyurtmalar') {
    // Producer/Admin uchun
    if (role === 'PRODUCER' || role === 'ADMIN') {
      await viewAllOrders(bot, chatId);
    } else {
      bot.sendMessage(chatId, MESSAGES.UNAUTHORIZED);
    }
  } else if (text === '📈 Hisobotlar') {
    // Producer/Admin uchun
    if (role === 'PRODUCER' || role === 'ADMIN') {
      await getDailySummary(bot, chatId);
    } else {
      bot.sendMessage(chatId, MESSAGES.UNAUTHORIZED);
    }
  } else if (text === '🔨 Ishlab chiqarish') {
    // Producer/Admin uchun
    if (role === 'PRODUCER' || role === 'ADMIN') {
      bot.sendMessage(chatId, '🚧 Ishlab chiqarish funksiyasi tez orada qo\'shiladi...');
    } else {
      bot.sendMessage(chatId, MESSAGES.UNAUTHORIZED);
    }
  }
});

// Callback query handler
bot.on('callback_query', async (query) => {
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  const data = query.data;

  if (!chatId || !messageId) return;

  // Callback'ni answer qilish
  bot.answerCallbackQuery(query.id);

  // Mahsulot tanlash
  if (data?.startsWith('select_product:')) {
    const productId = data.split(':')[1];
    await selectProduct(bot, chatId, messageId, productId);
  } else if (data === 'confirm_order') {
    await confirmOrder(bot, chatId);
  } else if (data === 'cancel_order') {
    await cancelOrder(bot, chatId);
  } else if (data === 'back_to_menu') {
    const role = await getUserRole(query.from.id);
    
    if (role === 'DISTRIBUTOR') {
      bot.sendMessage(chatId, 'Asosiy menyu:', {
        reply_markup: {
          keyboard: [
            [{ text: '📦 Yangi buyurtma' }, { text: '📋 Mening buyurtmalarim' }],
            [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
            [{ text: '❓ Yordam' }],
          ],
          resize_keyboard: true,
        },
      });
    } else if (role === 'PRODUCER' || role === 'ADMIN') {
      bot.sendMessage(chatId, 'Admin menyu:', {
        reply_markup: {
          keyboard: [
            [{ text: '📊 Buyurtmalar' }, { text: '🔨 Ishlab chiqarish' }],
            [{ text: '📈 Hisobotlar' }, { text: '👤 Profil' }],
            [{ text: '❓ Yordam' }],
          ],
          resize_keyboard: true,
        },
      });
    }
  } else if (data === 'mark_all_read') {
    const userInfo = await getUserInfo(query.from.id);
    if (userInfo) {
      await markAllNotificationsRead(bot, chatId, userInfo.id);
    }
  } else if (data === 'delete_all_notifications') {
    const userInfo = await getUserInfo(query.from.id);
    if (userInfo) {
      await deleteAllNotifications(bot, chatId, userInfo.id);
    }
  } else if (data === 'delete_all_notifications') {
    const userInfo = await getUserInfo(query.from.id);
    if (userInfo) {
      await deleteAllNotifications(bot, chatId, userInfo.id);
    }
  } else if (data === 'orders_all') {
    await viewAllOrders(bot, chatId);
  } else if (data === 'orders_today') {
    await viewAllOrders(bot, chatId, 'today');
  } else if (data === 'orders_pending') {
    await viewAllOrders(bot, chatId, 'pending');
  }
});

export default bot;