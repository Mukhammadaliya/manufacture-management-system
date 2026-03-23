import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';
import { formatDate, formatOrderNumber, getTodayDate, formatPrice } from '../utils/orderHelpers';

const prisma = new PrismaClient();

// Buyurtma ban holatini tekshirish
export async function isOrderBanned(): Promise<boolean> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'order_ban' },
    });
    if (!setting) return false;
    const value = setting.value as any;
    return value?.banned === true;
  } catch {
    return false;
  }
}

// Buyurtma ban qilish/ochish
export async function setOrderBan(banned: boolean, userId: string): Promise<void> {
  const value = banned
    ? { banned: true, bannedAt: new Date().toISOString(), bannedBy: userId }
    : { banned: false };

  await prisma.systemSetting.upsert({
    where: { key: 'order_ban' },
    update: { value },
    create: { key: 'order_ban', value, description: 'Buyurtma berish blokirovkasi' },
  });
}

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
  currentPage: number;
  forDistributorId?: string;
  lastMessageId?: number;
}

const orderSessions = new Map<number, OrderSession>();

const PRODUCTS_PER_PAGE = 8;

function buildProductPageKeyboard(
  products: Array<{ id: string; name: string; price: any }>,
  selectedProductIds: string[],
  page: number,
  hasItems: boolean
): { keyboard: TelegramBot.InlineKeyboardButton[][]; totalPages: number; text: string } {
  const remaining = products.filter((p) => !selectedProductIds.includes(p.id));
  const totalPages = Math.max(1, Math.ceil(remaining.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PRODUCTS_PER_PAGE;
  const pageProducts = remaining.slice(start, start + PRODUCTS_PER_PAGE);

  const keyboard: TelegramBot.InlineKeyboardButton[][] = pageProducts.map((p) => [
    {
      text: `${p.name} — ${formatPrice(p.price)}`,
      callback_data: `select_product:${p.id}`,
    },
  ]);

  // Navigation row
  const navRow: TelegramBot.InlineKeyboardButton[] = [];
  if (safePage > 0) {
    navRow.push({ text: '⬅️', callback_data: 'order_page_prev' });
  }
  navRow.push({ text: `📄 ${safePage + 1}/${totalPages}`, callback_data: 'order_page_noop' });
  if (safePage < totalPages - 1) {
    navRow.push({ text: '➡️', callback_data: 'order_page_next' });
  }
  if (totalPages > 1) {
    keyboard.push(navRow);
  }

  // Action buttons
  if (hasItems) {
    keyboard.push([{ text: '✅ Buyurtmani tasdiqlash', callback_data: 'confirm_order' }]);
  }
  keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

  const text = remaining.length > 0
    ? `📦 Mahsulot tanlang (${safePage + 1}/${totalPages}):`
    : '📦 Barcha mahsulotlar tanlandi.';

  return { keyboard, totalPages, text };
}

export const startNewOrder = async (bot: TelegramBot, chatId: number, userId: string, userRole?: string) => {
  try {
    if (await isOrderBanned()) {
      await bot.sendMessage(chatId, '🚫 Hozirda buyurtma berish to\'xtatilgan. Iltimos, keyinroq urinib ko\'ring.');
      return;
    }

    // Producer/Admin: first select distributor
    if (userRole === 'PRODUCER' || userRole === 'ADMIN') {
      const distributors = await prisma.user.findMany({
        where: { role: 'DISTRIBUTOR', isActive: true },
        orderBy: { name: 'asc' },
      });

      if (distributors.length === 0) {
        await bot.sendMessage(chatId, '❌ Faol distribyutorlar topilmadi.');
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = distributors.map((d) => [
        {
          text: `${d.name}${d.companyName ? ' — "' + d.companyName + '"' : ''}`,
          callback_data: `select_distributor:${d.id}`,
        },
      ]);
      keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

      await bot.sendMessage(chatId, '👥 Qaysi distribyutor uchun buyurtma yaratmoqchisiz?', {
        reply_markup: { inline_keyboard: keyboard },
      });
      return;
    }

    // Distributor: go directly to product selection
    await showProductPage(bot, chatId, userId);
  } catch (error) {
    logger.error('startNewOrder error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

async function showProductPage(bot: TelegramBot, chatId: number, userId: string, forDistributorId?: string) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  if (products.length === 0) {
    await bot.sendMessage(chatId, '❌ Hozirda mahsulotlar mavjud emas.');
    return;
  }

  const session: OrderSession = {
    userId,
    step: 'selecting_products',
    items: [],
    currentPage: 0,
    ...(forDistributorId && { forDistributorId }),
  };
  orderSessions.set(chatId, session);

  const { keyboard, text } = buildProductPageKeyboard(products, [], 0, false);
  const sent = await bot.sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: keyboard },
  });
  session.lastMessageId = sent.message_id;
  orderSessions.set(chatId, session);
}

export const selectDistributor = async (
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  distributorId: string,
  producerUserId: string
) => {
  try {
    const distributor = await prisma.user.findUnique({ where: { id: distributorId } });
    if (!distributor) {
      await bot.sendMessage(chatId, '❌ Distribyutor topilmadi.');
      return;
    }

    orderSessions.delete(chatId);
    await showProductPage(bot, chatId, producerUserId, distributorId);
  } catch (error) {
    logger.error('selectDistributor error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

export const handlePageNavigation = async (
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  direction: 'next' | 'prev'
) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session) return;

    session.currentPage += direction === 'next' ? 1 : -1;
    session.currentPage = Math.max(0, session.currentPage);

    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const selectedIds = session.items.map((i) => i.productId);
    const { keyboard, text } = buildProductPageKeyboard(products, selectedIds, session.currentPage, session.items.length > 0);

    orderSessions.set(chatId, session);

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('handlePageNavigation error:', error);
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

    const selectedIds = session.items.map((i) => i.productId);
    const { keyboard, text } = buildProductPageKeyboard(products, selectedIds, session.currentPage, true);

    orderSessions.set(chatId, session);

    const sent = await bot.sendMessage(chatId, `${summary}\n${text}`, {
      reply_markup: { inline_keyboard: keyboard },
    });
    session.lastMessageId = sent.message_id;
    orderSessions.set(chatId, session);
  } catch (error) {
    logger.error('enterQuantity error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

export const confirmOrder = async (bot: TelegramBot, chatId: number) => {
  try {
    // Ban tekshiruvi
    if (await isOrderBanned()) {
      orderSessions.delete(chatId);
      await bot.sendMessage(chatId, '🚫 Buyurtma berish to\'xtatilgan. Buyurtmangiz bekor qilindi.', {
        reply_markup: {
          keyboard: [
            [{ text: '📦 Yangi buyurtma' }, { text: '📋 Mening buyurtmalarim' }],
            [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
            [{ text: '❓ Yordam' }],
          ],
          resize_keyboard: true,
        },
      });
      return;
    }

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
        distributorId: session.forDistributorId || session.userId,
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
          [{ text: '📦 Yangi buyurtma' }, { text: '📋 Mening buyurtmalarim' }],
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
    // If order was created on behalf of a distributor by producer, notify the distributor
    if (order.createdBy !== order.distributorId) {
      try {
        const distMsg =
          `📦 Sizning nomingizdan buyurtma yaratildi!\n\n` +
          `🔢 ${formatOrderNumber(order.orderSeq)}\n` +
          `📅 ${formatDate(order.orderDate)}\n` +
          `📦 ${order.items.length} ta mahsulot\n` +
          `💰 ${formatPrice(order.totalAmount)}`;

        const distUser = await prisma.user.findUnique({ where: { id: order.distributorId } });
        if (distUser) {
          await bot.sendMessage(Number(distUser.telegramId), distMsg);

          await prisma.notification.create({
            data: {
              userId: distUser.id,
              type: 'ORDER_STATUS',
              title: `Yangi buyurtma ${formatOrderNumber(order.orderSeq)}`,
              message: `Sizning nomingizdan buyurtma yaratildi.`,
              relatedEntityType: 'order',
              relatedEntityId: order.id,
            },
          });
        }
      } catch (e) {
        logger.warn(`Could not notify distributor:`, e);
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
        [{ text: '📦 Yangi buyurtma' }, { text: '📋 Mening buyurtmalarim' }],
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
  userId: string,
  statusFilter?: string
) => {
  try {
    orderSessions.delete(chatId);

    const where: any = { distributorId: userId };
    if (statusFilter && statusFilter !== 'ALL') {
      where.status = statusFilter;
    }

    const orders = await prisma.order.findMany({
      where,
      orderBy: { orderSeq: 'desc' },
      take: 20,
    });

    // Filter tugmalari
    const filterButtons: any[][] = [
      [
        { text: `${!statusFilter || statusFilter === 'ALL' ? '🔘' : ''} Barchasi`, callback_data: 'my_orders_ALL' },
        { text: `${statusFilter === 'DRAFT' ? '🔘' : ''} ⏳ Kutilmoqda`, callback_data: 'my_orders_DRAFT' },
      ],
      [
        { text: `${statusFilter === 'CONFIRMED' ? '🔘' : ''} ✅ Tasdiqlangan`, callback_data: 'my_orders_CONFIRMED' },
        { text: `${statusFilter === 'DELIVERED' ? '🔘' : ''} 📦 Yetkazilgan`, callback_data: 'my_orders_DELIVERED' },
      ],
    ];

    if (orders.length === 0) {
      await bot.sendMessage(chatId, '📋 Buyurtmalar topilmadi.', {
        reply_markup: {
          inline_keyboard: [...filterButtons, [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]],
        },
      });
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
        inline_keyboard: [...filterButtons, [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]],
      },
    });
  } catch (error) {
    logger.error('viewMyOrders error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};
