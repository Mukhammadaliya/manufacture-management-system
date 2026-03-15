import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';
import { formatDate, formatOrderNumber, getTodayDate, formatPrice } from '../utils/orderHelpers';

const prisma = new PrismaClient();

interface OrderSession {
  userId: string;
  step: 'selecting_products' | 'entering_quantity';
  items: Array<{
    productId: string;
    productName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  }>;
}

const orderSessions = new Map<number, OrderSession>();

export const startNewOrder = async (bot: TelegramBot, chatId: number, userId: string) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) {
      await bot.sendMessage(chatId, '❌ Hozirda mahsulotlar mavjud emas.');
      return;
    }

    orderSessions.set(chatId, { userId, step: 'selecting_products', items: [] });

    const keyboard = products.map((p) => [
      {
        text: `${p.name} — ${formatPrice(p.price)}`,
        callback_data: `select_product:${p.id}`,
      },
    ]);
    keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

    await bot.sendMessage(chatId, '📦 Mahsulot tanlang:', {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('startNewOrder error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

export const selectProduct = async (
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  productId: string
) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, '❌ Sessiya topilmadi. /start bosing.');
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    session.step = 'entering_quantity';
    session.items.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity: 0,
      unitPrice: Number(product.price),
    });
    orderSessions.set(chatId, session);

    await bot.editMessageText(
      `📦 ${product.name}\n💰 ${formatPrice(product.price)}\n\n🔢 Miqdorni kiriting (${product.unit}):`,
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]],
        },
      }
    );
  } catch (error) {
    logger.error('selectProduct error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

export const enterQuantity = async (
  bot: TelegramBot,
  chatId: number,
  quantity: number
) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session || session.step !== 'entering_quantity') return;

    const lastItem = session.items[session.items.length - 1];
    lastItem.quantity = quantity;
    session.step = 'selecting_products';

    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    let summary = '📋 Tanlangan mahsulotlar:\n';
    session.items.forEach((item, i) => {
      summary += `${i + 1}. ${item.productName} — ${item.quantity} ${item.unit}\n`;
    });

    const remaining = products.filter(
      (p) => !session.items.find((i) => i.productId === p.id)
    );
    const keyboard: TelegramBot.InlineKeyboardButton[][] = remaining.map((p) => [
      {
        text: `${p.name} — ${formatPrice(p.price)}`,
        callback_data: `select_product:${p.id}`,
      },
    ]);
    keyboard.push([{ text: '✅ Buyurtmani tasdiqlash', callback_data: 'confirm_order' }]);
    keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

    orderSessions.set(chatId, session);

    await bot.sendMessage(chatId, `${summary}\nQo'shish yoki tasdiqlash:`, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('enterQuantity error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

export const confirmOrder = async (bot: TelegramBot, chatId: number) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session || session.items.length === 0) {
      await bot.sendMessage(chatId, '❌ Buyurtmada mahsulotlar yo\'q.');
      return;
    }

    const today = getTodayDate();
    const totalAmount = session.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );

    const order = await prisma.order.create({
      data: {
        distributorId: session.userId,
        orderDate: today,
        status: 'DRAFT',
        totalAmount,
        createdBy: session.userId,
        updatedBy: session.userId,
        items: {
          create: session.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            createdBy: session.userId,
            updatedBy: session.userId,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'DRAFT',
        changedBy: session.userId,
        notes: 'Buyurtma yaratildi',
      },
    });

    orderSessions.delete(chatId);

    let msg = `✅ Buyurtma yaratildi!\n\n`;
    msg += `🔢 ${formatOrderNumber(order.orderSeq)}\n`;
    msg += `📅 ${formatDate(order.orderDate)}\n`;
    msg += `⏳ Kutilmoqda\n\n`;
    msg += `📦 Mahsulotlar:\n`;
    order.items.forEach((item, i) => {
      msg += `${i + 1}. ${item.product.name} — ${item.quantity} ${item.product.unit}\n`;
    });
    msg += `\n💰 Jami: ${formatPrice(totalAmount)}`;

    await bot.sendMessage(chatId, msg, {
      reply_markup: {
        keyboard: [
          [{ text: '📦 Yangi buyurtma' }, { text: '📋 Buyurtmalarim' }],
          [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
          [{ text: '❓ Yordam' }],
        ],
        resize_keyboard: true,
      },
    });

    // Producerlarga notification yuborish
    await notifyProducers(bot, order);

    logger.info(`Order created: ${formatOrderNumber(order.orderSeq)} by ${session.userId}`);
  } catch (error) {
    logger.error('confirmOrder error:', error);
    await bot.sendMessage(chatId, '❌ Buyurtma yaratishda xatolik.');
  }
};

async function notifyProducers(bot: TelegramBot, order: any) {
  try {
    const producers = await prisma.user.findMany({
      where: {
        role: { in: ['PRODUCER', 'ADMIN'] },
        isActive: true,
      },
    });

    const distributor = await prisma.user.findUnique({
      where: { id: order.distributorId },
    });

    const name = distributor?.companyName || distributor?.name || 'Noma\'lum';
    const msg =
      `🆕 Yangi buyurtma ${formatOrderNumber(order.orderSeq)}\n\n` +
      `👤 ${name}\n` +
      `📅 ${formatDate(order.orderDate)}\n` +
      `📦 ${order.items.length} ta mahsulot\n` +
      `💰 ${formatPrice(order.totalAmount)}`;

    for (const producer of producers) {
      try {
        await bot.sendMessage(Number(producer.telegramId), msg, {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Tasdiqlash', callback_data: `quick_confirm_${order.id}` },
                { text: '❌ Bekor qilish', callback_data: `quick_cancel_${order.id}` },
              ],
            ],
          },
        });

        await prisma.notification.create({
          data: {
            userId: producer.id,
            type: 'SYSTEM',
            title: `Yangi buyurtma ${formatOrderNumber(order.orderSeq)}`,
            message: `${name} tomonidan yangi buyurtma berildi.`,
            relatedEntityType: 'order',
            relatedEntityId: order.id,
          },
        });
      } catch (e) {
        logger.warn(`Could not notify producer ${producer.id}:`, e);
      }
    }
  } catch (error) {
    logger.error('notifyProducers error:', error);
  }
}

export const cancelOrder = async (bot: TelegramBot, chatId: number) => {
  orderSessions.delete(chatId);
  await bot.sendMessage(chatId, '❌ Buyurtma bekor qilindi.', {
    reply_markup: {
      keyboard: [
        [{ text: '📦 Yangi buyurtma' }, { text: '📋 Buyurtmalarim' }],
        [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
        [{ text: '❓ Yordam' }],
      ],
      resize_keyboard: true,
    },
  });
};

export const getOrderSession = (chatId: number) => orderSessions.get(chatId);

export const viewMyOrders = async (
  bot: TelegramBot,
  chatId: number,
  userId: string
) => {
  try {
    orderSessions.delete(chatId);

    const orders = await prisma.order.findMany({
      where: { distributorId: userId },
      orderBy: { orderSeq: 'desc' },
      take: 10,
    });

    if (orders.length === 0) {
      await bot.sendMessage(chatId, '📋 Hali buyurtmalar yo\'q.');
      return;
    }

    let msg = '📋 Buyurtmalarim:\n\n';
    orders.forEach((order, i) => {
      const emoji =
        order.status === 'DRAFT' ? '⏳'
        : order.status === 'CONFIRMED' ? '✅'
        : order.status === 'DELIVERED' ? '📦'
        : '❌';
      const label =
        order.status === 'DRAFT' ? 'Kutilmoqda'
        : order.status === 'CONFIRMED' ? 'Tasdiqlangan'
        : order.status === 'DELIVERED' ? 'Yetkazilgan'
        : 'Bekor qilingan';

      msg += `${i + 1}. ${formatOrderNumber(order.orderSeq)} — ${emoji} ${label}\n`;
      msg += `   📅 ${formatDate(order.orderDate)}\n\n`;
    });

    await bot.sendMessage(chatId, msg, {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]],
      },
    });
  } catch (error) {
    logger.error('viewMyOrders error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};
