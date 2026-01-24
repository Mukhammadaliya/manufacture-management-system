import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';
import { findUser, createUser, getUserInfo } from './utils/userManager';
import {
  startNewOrder,
  selectProduct,
  enterQuantity,
  enterDate,
  confirmOrder,
  cancelOrder,
  getOrderSession,
  viewMyOrders,
} from './handlers/orderHandler';
import {
  viewNotifications,
  markAllNotificationsRead,
  deleteAllNotifications,
} from './handlers/notificationHandler';
import {
  handleViewOrders,
  handleViewOrderDetail,
  handleChangeStatus,
  handleSetStatus,
  handleChangeQuantities,
  handleDailySummary,
  handleReportMenu,
  handleReportToday,
  handleReportYesterday,
  handleDeleteItem,            
  handleConfirmDeleteItem,      
  handleDeleteOrder,            
  handleConfirmDeleteOrder,       
  handlePendingUsers,
  handlePendingUserDetail,
  handleApproveUser,
  handleRejectUser,
} from './handlers/producerHandler';

dotenv.config();

const prisma = new PrismaClient();
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });

// Sessions
interface QuantityChangeSession {
  userId: string;
  itemId: string;
  orderId: string;
  newQuantity?: number;
  awaitingReason?: boolean;
}

interface RegistrationSession {
  telegramUser: any;
  step: 'role' | 'phone' | 'company' | 'confirm';
  role?: 'DISTRIBUTOR' | 'PRODUCER';
  phone?: string;
  companyName?: string;
}

const quantityChangeSessions: { [key: number]: QuantityChangeSession } = {};
const reportDateSessions: { [key: number]: boolean } = {};
const registrationSessions: { [key: number]: RegistrationSession } = {};

logger.info('🤖 Telegram Bot ishga tushdi!');

bot.on('polling_error', (error) => {
  logger.error('Bot polling error:', error);
});

// Helper function - yuqorida e'lon qilish kerak
async function showRegistrationConfirm(bot: TelegramBot, chatId: number, session: RegistrationSession) {
  const roleName = session.role === 'DISTRIBUTOR' ? 'Distribyutor' : 'Ishlab chiqaruvchi';
  
  let message = `📋 **Ma'lumotlaringizni tasdiqlang:**\n\n`;
  message += `👤 Ism: ${session.telegramUser.first_name} ${session.telegramUser.last_name || ''}\n`;
  message += `📞 Telefon: ${session.phone}\n`;
  message += `👔 Rol: ${roleName}\n`;
  
  if (session.companyName) {
    message += `🏢 Kompaniya: ${session.companyName}\n`;
  }
  
  message += `\n✅ Ma'lumotlar to'g'ri bo'lsa "Tasdiqlash" tugmasini bosing.`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Tasdiqlash', callback_data: 'reg_confirm' },
          { text: '❌ Bekor qilish', callback_data: 'reg_cancel' },
        ],
      ],
    },
  });
}

// /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (!msg.from) return;

  try {
    const user = await findUser(msg.from.id);

    if (!user) {
      registrationSessions[chatId] = {
        telegramUser: msg.from,
        step: 'role',
      };

      const message =
        `Assalomu alaykum! 👋\n\n` +
        `🥩 Real Taste of Meat - Buyurtmalar botiga xush kelibsiz!\n\n` +
        `Iltimos, rolni tanlang:`;

      await bot.sendMessage(chatId, message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 Distribyutor (Zakaz beruvchi)', callback_data: 'reg_role_DISTRIBUTOR' }],
            [{ text: '🔨 Ishlab chiqaruvchi (Zakaz qabul qiluvchi)', callback_data: 'reg_role_PRODUCER' }],
          ],
        },
      });
      return;
    }

    if (!user.isActive) {
      await bot.sendMessage(
        chatId,
        `✋ Sizning arizangiz ko'rib chiqilmoqda.\n\n` +
          `👤 Ism: ${user.name}\n` +
          `📞 Telefon: ${user.phone || 'Ko\'rsatilmagan'}\n` +
          `👔 Rol: ${user.role === 'DISTRIBUTOR' ? 'Distribyutor' : 'Ishlab chiqaruvchi'}\n\n` +
          `Admin tomonidan tasdiqlanganidan keyin botdan foydalanishingiz mumkin bo'ladi.\n\n` +
           `📞 Aloqa: \`+998887011942\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const welcomeMessage =
      `Assalomu alaykum, ${user.name}! 👋\n\n` +
      `🥩 Real Taste of Meat - Buyurtmalar botiga xush kelibsiz!\n\n` +
      `Bu bot orqali siz:\n` +
      `✅ Buyurtma berishingiz\n` +
      `✅ Buyurtmalaringizni kuzatishingiz\n` +
      `✅ Xabarnomalar olishingiz mumkin`;

    await bot.sendMessage(chatId, welcomeMessage, {
      reply_markup: getMainKeyboard(user.role),
    });

    logger.info(`User ${user.telegramId} started the bot`);
  } catch (error) {
    logger.error('Error in /start command:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
});

// Message handler
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!msg.from) return;

  try {
    // Contact (telefon raqam) qabul qilish
    if (msg.contact && registrationSessions[chatId]) {
      const session = registrationSessions[chatId];
      
      if (session.step === 'phone') {
        const phoneNumber = msg.contact.phone_number;
        
        // +998 bilan boshlanishini tekshirish
        if (!phoneNumber.startsWith('+998') && !phoneNumber.startsWith('998')) {
          await bot.sendMessage(chatId, '❌ Faqat O\'zbekiston raqamlari qabul qilinadi (+998).');
          return;
        }

        // Formatni to'g'rilash
        session.phone = phoneNumber.startsWith('+') ? phoneNumber : '+' + phoneNumber;

        if (session.role === 'DISTRIBUTOR') {
          session.step = 'company';
          await bot.sendMessage(chatId, '🏢 Kompaniya nomini kiriting:', {
            reply_markup: { remove_keyboard: true },
          });
          return;
        } else {
          session.step = 'confirm';
          await showRegistrationConfirm(bot, chatId, session);
          return;
        }
      }
    }    

    if (!text || text.startsWith('/')) return;

    // Bekor qilish tugmasi
    if (text === '❌ Bekor qilish' && registrationSessions[chatId]) {
      delete registrationSessions[chatId];
      await bot.sendMessage(
        chatId,
        '❌ Ro\'yxatdan o\'tish bekor qilindi.\n\nQaytadan boshlash uchun /start buyrug\'ini yuboring.',
        { reply_markup: { remove_keyboard: true } }
      );
      return;
    }
    
    // Registration session tekshirish
    if (registrationSessions[chatId]) {
      const session = registrationSessions[chatId];

      if (session.step === 'phone') {
        const phoneRegex = /^\+998\d{9}$/;
        
        if (!phoneRegex.test(text)) {
          await bot.sendMessage(
            chatId,
            '❌ Noto\'g\'ri format. Iltimos, to\'g\'ri formatda kiriting:\n\n+998XXXXXXXXX\n\nMasalan: +998901234567'
          );
          return;
        }

        session.phone = text;

        if (session.role === 'DISTRIBUTOR') {
          session.step = 'company';
          await bot.sendMessage(chatId, '🏢 Kompaniya nomini kiriting:', {
            reply_markup: { remove_keyboard: true },
          });
          return;
        } else {
          session.step = 'confirm';
          await showRegistrationConfirm(bot, chatId, session);
          return;
        }
      }

      if (session.step === 'company') {
        if (text.length < 2) {
          await bot.sendMessage(chatId, '❌ Kompaniya nomi juda qisqa. Iltimos, qaytadan kiriting:');
          return;
        }

        session.companyName = text;
        session.step = 'confirm';
        await showRegistrationConfirm(bot, chatId, session);
        return;
      }

      return;
    }

    // IKKINCHI: User tekshirish
    const user = await findUser(msg.from.id);
    if (!user || !user.isActive) return;

    // Order session - miqdor kiritish
    const session = getOrderSession(chatId);
    if (session && session.step === 'entering_quantity') {
      const quantity = parseFloat(text);
      if (isNaN(quantity) || quantity <= 0) {
        await bot.sendMessage(chatId, '❌ Noto\'g\'ri miqdor. Musbat son kiriting:');
        return;
      }
      await enterQuantity(bot, chatId, quantity);
      return;
    }

    // Order session - sana kiritish
    if (session && session.step === 'selecting_dates') {
      await enterDate(bot, chatId, text);
      return;
    }

    // Quantity change session - miqdor kiritish
    if (quantityChangeSessions[chatId] && !quantityChangeSessions[chatId].awaitingReason) {
      const newQuantity = parseFloat(text);
      if (isNaN(newQuantity) || newQuantity < 0) {
        await bot.sendMessage(chatId, '❌ Iltimos, to\'g\'ri raqam kiriting (0 yoki undan katta).');
        return;
      }

      const qtySession = quantityChangeSessions[chatId];

      if (newQuantity === 0) {
        const item = await prisma.orderItem.findUnique({
          where: { id: qtySession.itemId },
          include: { 
            product: true,
            order: { include: { distributor: true, items: true } },
          },
        });

        if (!item) {
          await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
          delete quantityChangeSessions[chatId];
          return;
        }

        if (item.order.items.length === 1) {
          await bot.sendMessage(chatId, '❌ Buyurtmada kamida bitta mahsulot bo\'lishi kerak. 0 kiritib bo\'lmaydi.');
          delete quantityChangeSessions[chatId];
          return;
        }

        const message =
          `⚠️ **Mahsulotni o'chirish**\n\n` +
          `Siz 0 miqdor kiritdingiz. Bu mahsulotni buyurtmadan o'chirmoqchimisiz?\n\n` +
          `📦 Mahsulot: ${item.product.name}\n` +
          `📋 Buyurtma: ${item.order.orderNumber}`;

        quantityChangeSessions[chatId] = {
          ...qtySession,
          newQuantity: 0,
          awaitingReason: true,
          ['deleteConfirmation' as any]: true,
        };

        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Ha, o\'chirish', callback_data: `confirm_qty_delete_${qtySession.itemId}` },
                { text: '❌ Bekor qilish', callback_data: `cancel_qty_change_${qtySession.orderId}` },
              ],
            ],
          },
        });
        return;
      }

      const item = await prisma.orderItem.findUnique({
        where: { id: qtySession.itemId },
        include: { product: true },
      });

      if (!item) {
        await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
        delete quantityChangeSessions[chatId];
        return;
      }

      const message =
        `📝 **Miqdor o'zgarishi**\n\n` +
        `📦 Mahsulot: ${item.product.name}\n` +
        `📊 Eski miqdor: ${item.adjustedQuantity || item.quantity} ${item.product.unit}\n` +
        `📊 Yangi miqdor: ${newQuantity} ${item.product.unit}\n\n` +
        `O'zgartirish sababini kiriting:`;

      quantityChangeSessions[chatId] = {
        ...qtySession,
        newQuantity: newQuantity,
        awaitingReason: true,
      };

      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
      return;
    }

    // Quantity change session - sabab kiritish
    if (quantityChangeSessions[chatId] && quantityChangeSessions[chatId].awaitingReason) {
      const qtySession = quantityChangeSessions[chatId];
      const reason = text;
      const newQuantity = qtySession.newQuantity!;

      const item = await prisma.orderItem.findUnique({
        where: { id: qtySession.itemId },
        include: {
          product: true,
          order: { include: { distributor: true } },
        },
      });

      if (!item) {
        await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
        delete quantityChangeSessions[chatId];
        return;
      }

      await prisma.orderItem.update({
        where: { id: qtySession.itemId },
        data: {
          adjustedQuantity: newQuantity,
          adjustmentReason: reason,
        },
      });

      await prisma.notification.create({
        data: {
          userId: item.order.distributorId,
          type: 'ORDER_CHANGE',
          title: 'Buyurtma miqdori o\'zgartirildi',
          message: `${item.order.orderNumber} buyurtmadagi ${item.product.name} miqdori ${item.adjustedQuantity || item.quantity} dan ${newQuantity} ga o'zgartirildi.\n\nSabab: ${reason}`,
          relatedEntityType: 'order',
          relatedEntityId: item.orderId,
        },
      });

      const successMessage =
        `✅ **Miqdor muvaffaqiyatli o'zgartirildi!**\n\n` +
        `📦 Mahsulot: ${item.product.name}\n` +
        `📊 Yangi miqdor: ${newQuantity} ${item.product.unit}\n` +
        `ℹ️ Sabab: ${reason}\n\n` +
        `Distribyutorga xabar yuborildi.`;

      await bot.sendMessage(chatId, successMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${item.orderId}` }]],
        },
      });

      delete quantityChangeSessions[chatId];
      logger.info(`Order item ${qtySession.itemId} quantity changed to ${newQuantity}`);
      return;
    }

    // Report date input
    if (reportDateSessions[chatId]) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      
      if (!dateRegex.test(text)) {
        await bot.sendMessage(
          chatId,
          '❌ Noto\'g\'ri format. Iltimos, to\'g\'ri formatda kiriting:\n\nYYYY-MM-DD\n\nMasalan: 2026-01-10'
        );
        return;
      }

      const customDate = new Date(text);
      
      if (isNaN(customDate.getTime())) {
        await bot.sendMessage(chatId, '❌ Noto\'g\'ri sana. Iltimos, qaytadan kiriting:');
        return;
      }

      delete reportDateSessions[chatId];
      await handleDailySummary(bot, chatId, customDate);
      return;
    }

    // Menu buttons
    switch (text) {
      case '📦 Yangi buyurtma':
        const userInfo = await getUserInfo(msg.from.id);
        if (userInfo) {
          await startNewOrder(bot, chatId, userInfo.id);
        }
        break;

      case '📋 Mening buyurtmalarim':
        const userInfo2 = await getUserInfo(msg.from.id);
        if (userInfo2) {
          await viewMyOrders(bot, chatId, userInfo2.id);
        }
        break;

      case '🔔 Xabarnomalar':
        const userInfo3 = await getUserInfo(msg.from.id);
        if (userInfo3) {
          await viewNotifications(bot, chatId, userInfo3.id);
        }
        break;

      case '📊 Buyurtmalar':
        if (user.role === 'PRODUCER' || user.role === 'ADMIN') {
          await showOrderFilters(bot, chatId);
        }
        break;

      case '📈 Hisobotlar':
        if (user.role === 'PRODUCER' || user.role === 'ADMIN') {
          await handleReportMenu(bot, chatId);
        }
        break;

      case '👥 Foydalanuvchilar':  // <-- Yangi
        if (user.role === 'PRODUCER' || user.role === 'ADMIN') {
          await handlePendingUsers(bot, chatId);
        }
        break;

      case '👤 Profil':
        await handleProfile(bot, chatId, user);
        break;

      case '❓ Yordam':
        await handleHelp(bot, chatId, user.role);
        break;
    }
  } catch (error) {
    logger.error('Error in message handler:', error);
  }
});

// Callback query handler
bot.on('callback_query', async (query) => {
  const chatId = query.message!.chat.id;
  const messageId = query.message!.message_id;
  const data = query.data!;

  if (!query.from) return;

  try {
    const user = await findUser(query.from.id);

    // Registration callbacks
    if (data?.startsWith('reg_role_')) {
      const role = data.replace('reg_role_', '') as 'DISTRIBUTOR' | 'PRODUCER';
      
      if (!registrationSessions[chatId]) {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      registrationSessions[chatId].role = role;
      registrationSessions[chatId].step = 'phone';

      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }

      const message =
        `✅ Rol tanlandi: ${role === 'DISTRIBUTOR' ? 'Distribyutor' : 'Ishlab chiqaruvchi'}\n\n` +
        `📞 Iltimos, telefon raqamingizni yuboring:\n\n` +
        `Quyidagi "📱 Telefon raqamni yuborish" tugmasini bosing yoki qo'lda kiriting.`;

      await bot.sendMessage(chatId, message, {
        reply_markup: {
          keyboard: [
            [{ text: '📱 Telefon raqamni yuborish', request_contact: true }],
            [{ text: '❌ Bekor qilish' }],
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'reg_confirm') {
      const session = registrationSessions[chatId];
      
      if (!session) {
        await bot.answerCallbackQuery(query.id);
        return;
      }

      const newUser = await createUser(
        session.telegramUser,
        session.role as any,
        {
          phone: session.phone,
          companyName: session.companyName,
        }
      );

      if (!newUser) {
        await bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
        delete registrationSessions[chatId];
        await bot.answerCallbackQuery(query.id);
        return;
      }

      delete registrationSessions[chatId];

      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }

      const successMessage =
        `✅ **Ro'yxatdan o'tdingiz!**\n\n` +
        `Arizangiz admin tomonidan ko'rib chiqilmoqda.\n\n` +
        `Tasdiqlangandan so'ng sizga xabar beriladi.\n\n` +
        `📞 Aloqa: \`+998887011942\``;

      await bot.sendMessage(chatId, successMessage, {
        parse_mode: 'Markdown',
      });

      logger.info(`New registration: ${newUser.name} (${newUser.telegramId}) - Role: ${newUser.role}`);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'reg_cancel') {
      delete registrationSessions[chatId];

      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }

      await bot.sendMessage(chatId, '❌ Ro\'yxatdan o\'tish bekor qilindi.\n\nQaytadan boshlash uchun /start buyrug\'ini yuboring.');
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (!user || !user.isActive) {
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // Product selection
    if (data.startsWith('select_product:')) {
      const productId = data.split(':')[1];
      await selectProduct(bot, chatId, messageId, productId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'confirm_order') {
      await confirmOrder(bot, chatId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'cancel_order') {
      await cancelOrder(bot, chatId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'view_orders_today') {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }
      await handleViewOrders(bot, chatId, 'today');
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'view_orders_pending') {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }
      await handleViewOrders(bot, chatId, 'pending');
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'view_orders_all') {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }
      await handleViewOrders(bot, chatId, 'all');
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('view_order_')) {
      const orderId = data.replace('view_order_', '');
      
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }
      
      await handleViewOrderDetail(bot, chatId, orderId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('change_status_')) {
      const orderId = data.replace('change_status_', '');
      await handleChangeStatus(bot, chatId, orderId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('set_status_')) {
      const parts = data.replace('set_status_', '').split('_');
      const orderId = parts[0];
      const newStatus = parts.slice(1).join('_') as any;
      await handleSetStatus(bot, chatId, orderId, newStatus, user.id);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('change_quantities_')) {
      const orderId = data.replace('change_quantities_', '');
      await handleChangeQuantities(bot, chatId, orderId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('delete_order_')) {
      const orderId = data.replace('delete_order_', '');
      await handleDeleteOrder(bot, chatId, orderId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('confirm_delete_order_')) {
      const orderId = data.replace('confirm_delete_order_', '');
      await handleConfirmDeleteOrder(bot, chatId, orderId, user.id);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('change_item_')) {
      const itemId = data.replace('change_item_', '');
      await handleChangeItemStart(bot, chatId, itemId, user.id);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('delete_item_')) {
      const itemId = data.replace('delete_item_', '');
      await handleDeleteItem(bot, chatId, itemId, user.id);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('confirm_delete_item_')) {
      const itemId = data.replace('confirm_delete_item_', '');
      await handleConfirmDeleteItem(bot, chatId, itemId, user.id);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('confirm_qty_delete_')) {
      const itemId = data.replace('confirm_qty_delete_', '');
      
      const item = await prisma.orderItem.findUnique({
        where: { id: itemId },
        include: {
          product: true,
          order: { include: { distributor: true } },
        },
      });

      if (!item) {
        await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
        await bot.answerCallbackQuery(query.id);
        return;
      }

      await prisma.orderItem.delete({ where: { id: itemId } });

      await prisma.notification.create({
        data: {
          userId: item.order.distributorId,
          type: 'ORDER_CHANGE',
          title: 'Buyurtmadan mahsulot o\'chirildi',
          message: `${item.order.orderNumber} buyurtmadan ${item.product.name} mahsuloti o'chirib tashlandi (miqdor 0 kiritildi).`,
          relatedEntityType: 'order',
          relatedEntityId: item.orderId,
        },
      });

      await bot.sendMessage(chatId, `✅ ${item.product.name} buyurtmadan o'chirildi.`, {
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${item.orderId}` }]],
        },
      });

      delete quantityChangeSessions[chatId];
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data.startsWith('cancel_qty_change_')) {
      const orderId = data.replace('cancel_qty_change_', '');
      delete quantityChangeSessions[chatId];
      
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }
      
      await handleViewOrderDetail(bot, chatId, orderId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'mark_all_read') {
      await markAllNotificationsRead(bot, chatId, user.id);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'delete_all_notifications') {
      await deleteAllNotifications(bot, chatId, user.id);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'report_today') {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }
      await handleReportToday(bot, chatId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'report_yesterday') {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }
      await handleReportYesterday(bot, chatId);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'report_custom_date') {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }
      
      reportDateSessions[chatId] = true;
      
      await bot.sendMessage(
        chatId,
        '📅 Sanani kiriting (format: YYYY-MM-DD)\n\nMasalan: 2026-01-10'
      );
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'back_to_menu') {
      try {
        await bot.deleteMessage(chatId, messageId);
      } catch (error) {
        logger.debug('Could not delete message:', error);
      }

      await bot.sendMessage(chatId, '🏠 Asosiy menyu:', {
        reply_markup: getMainKeyboard(user.role),
      });
      await bot.answerCallbackQuery(query.id);
      return;
    }

    // Pending users callbacks
    if (data === 'pending_users') {
      if (user.role === 'PRODUCER' || user.role === 'ADMIN') {
        try {
          await bot.deleteMessage(chatId, messageId);
        } catch (error) {
          logger.debug('Could not delete message:', error);
        }
        await handlePendingUsers(bot, chatId);
        await bot.answerCallbackQuery(query.id);
        return;
      }
    }

    if (data.startsWith('pending_user_')) {
      if (user.role === 'PRODUCER' || user.role === 'ADMIN') {
        const userId = data.replace('pending_user_', '');
        try {
          await bot.deleteMessage(chatId, messageId);
        } catch (error) {
          logger.debug('Could not delete message:', error);
        }
        await handlePendingUserDetail(bot, chatId, userId);
        await bot.answerCallbackQuery(query.id);
        return;
      }
    }

    if (data.startsWith('approve_user_')) {
      if (user.role === 'PRODUCER' || user.role === 'ADMIN') {
        const userId = data.replace('approve_user_', '');
        try {
          await bot.deleteMessage(chatId, messageId);
        } catch (error) {
          logger.debug('Could not delete message:', error);
        }
        await handleApproveUser(bot, chatId, userId, user.name);
        await bot.answerCallbackQuery(query.id);
        return;
      }
    }

    if (data.startsWith('reject_user_')) {
      if (user.role === 'PRODUCER' || user.role === 'ADMIN') {
        const userId = data.replace('reject_user_', '');
        try {
          await bot.deleteMessage(chatId, messageId);
        } catch (error) {
          logger.debug('Could not delete message:', error);
        }
        await handleRejectUser(bot, chatId, userId, user.name);
        await bot.answerCallbackQuery(query.id);
        return;
      }
    }

    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    logger.error('Error in callback query handler:', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ Xatolik' });
  }
});

// Helper functions
async function showOrderFilters(bot: TelegramBot, chatId: number) {
  const message = '📊 **Buyurtmalarni ko\'rish**\n\nQaysi buyurtmalarni ko\'rmoqchisiz?';

  const keyboard: TelegramBot.InlineKeyboardButton[][] = [
    [
      { text: '📅 Bugungi', callback_data: 'view_orders_today' },
      { text: '⏳ Kutilmoqda', callback_data: 'view_orders_pending' },
    ],
    [{ text: '🔄 Barchasi', callback_data: 'view_orders_all' }],
    [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
  ];

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function handleChangeItemStart(bot: TelegramBot, chatId: number, itemId: string, userId: string) {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { product: true, order: true },
    });

    if (!item) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    const currentQuantity = item.adjustedQuantity || item.quantity;

    quantityChangeSessions[chatId] = {
      userId: userId,
      itemId: itemId,
      orderId: item.orderId,
    };

    const message =
      `📝 **Miqdorni o'zgartirish**\n\n` +
      `📦 Mahsulot: ${item.product.name}\n` +
      `📊 Joriy miqdor: ${currentQuantity} ${item.product.unit}\n\n` +
      `Yangi miqdorni kiriting (raqam):`;

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error in handleChangeItemStart:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

async function handleProfile(bot: TelegramBot, chatId: number, user: any) {
  const message =
    `👤 **Profil ma'lumotlari**\n\n` +
    `📛 Ism: ${user.name}\n` +
    `📞 Telefon: ${user.phone || 'Ko\'rsatilmagan'}\n` +
    `🏢 Kompaniya: ${user.companyName || 'Ko\'rsatilmagan'}\n` +
    `👔 Rol: ${translateRole(user.role)}`;

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

async function handleHelp(bot: TelegramBot, chatId: number, role: string) {
  let message = `❓ **Yordam**\n\n`;

  if (role === 'DISTRIBUTOR') {
    message +=
      `📦 **Yangi buyurtma** - Yangi buyurtma yaratish\n` +
      `📋 **Mening buyurtmalarim** - Buyurtmalarni ko'rish\n` +
      `🔔 **Xabarnomalar** - Xabarnomalarni ko'rish\n` +
      `👤 **Profil** - Profil ma'lumotlari\n\n` +
      `📞 Aloqa: \`+998887011942\``;
  } else {
    message +=
      `📊 **Buyurtmalar** - Barcha buyurtmalarni ko'rish\n` +
      `📈 **Hisobotlar** - Kunlik hisobotlar\n` +
      `🔔 **Xabarnomalar** - Xabarnomalarni ko'rish\n\n` +
      `📞 Aloqa: \`+998887011942\``;
  }

  await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
}

function getMainKeyboard(role: string): TelegramBot.ReplyKeyboardMarkup {
  if (role === 'DISTRIBUTOR') {
    return {
      keyboard: [
        [{ text: '📦 Yangi buyurtma' }, { text: '📋 Mening buyurtmalarim' }],
        [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
        [{ text: '❓ Yordam' }],
      ],
      resize_keyboard: true,
    };
  } else {
    return {
      keyboard: [
        [{ text: '📊 Buyurtmalar' }, { text: '📈 Hisobotlar' }],
        [{ text: '👥 Foydalanuvchilar' }, { text: '🔔 Xabarnomalar' }],
        [{ text: '👤 Profil' }, { text: '❓ Yordam' }],
      ],
      resize_keyboard: true,
    };
  }
}

function translateRole(role: string): string {
  const translations: { [key: string]: string } = {
    DISTRIBUTOR: 'Distribyutor',
    PRODUCER: 'Ishlab chiqaruvchi',
    ADMIN: 'Administrator',
  };
  return translations[role] || role;
}

export default bot;