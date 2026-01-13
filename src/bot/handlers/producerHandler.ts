import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient, OrderStatus } from '@prisma/client';
import logger from '../../utils/logger';
import { log } from 'node:console';

const prisma = new PrismaClient();

// Buyurtmalarni filter bilan ko'rsatish
export async function handleViewOrders(bot: TelegramBot, chatId: number, filter: 'today' | 'pending' | 'all') {
  try {
    let whereCondition: any = {};

    if (filter === 'today') {
      // Bugungi sanani olish
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayDateStr = `${year}-${month}-${day}`;

      whereCondition = {
        orderDate: {
          gte: new Date(todayDateStr),
          lt: new Date(new Date(todayDateStr).getTime() + 24 * 60 * 60 * 1000),
        },
        status: {
          not: 'CANCELLED',
        },
      };
    } else if (filter === 'pending') {
      whereCondition = {
        status: {
          in: ['SUBMITTED', 'CONFIRMED'],
        },
      };
    } else if (filter === 'all') {
      whereCondition = {
        status: {
          notIn: ['DELIVERED', 'CANCELLED'],
        },
      };
    }

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        distributor: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 15,
    });

    if (orders.length === 0) {
      await bot.sendMessage(chatId, '📋 Buyurtmalar topilmadi.');
      return;
    }

    let message = '📊 **Buyurtmalar:**\n\n';

    orders.forEach((order, index) => {
      const statusEmoji = getStatusEmoji(order.status);
      const totalItems = order.items.length;
      const distributorName = order.distributor.companyName || order.distributor.name;

      message += `${index + 1}. ${order.orderNumber}\n`;
      message += `   👤 ${distributorName}\n`;
      message += `   📅 ${formatDate(order.orderDate)}\n`;
      message += `   ${statusEmoji} ${translateStatus(order.status)}\n`;
      message += `   📦 ${totalItems} ta mahsulot\n\n`;
    });

    // Inline keyboard - har bir buyurtma uchun "Batafsil" tugmasi
    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
    
    orders.forEach((order) => {
      keyboard.push([
        {
          text: `📋 ${order.orderNumber}`,
          callback_data: `view_order_${order.id}`,
        },
      ]);
    });

    keyboard.push([{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error('Error in handleViewOrders:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko\'ring.');
  }
}

// Bitta buyurtmani batafsil ko'rsatish
export async function handleViewOrderDetail(bot: TelegramBot, chatId: number, orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        distributor: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const statusEmoji = getStatusEmoji(order.status);
    const distributorName = order.distributor.companyName || order.distributor.name;

    let message = `📋 **Buyurtma tafsilotlari**\n\n`;
    message += `🔢 Raqam: ${order.orderNumber}\n`;
    message += `👤 Distribyutor: ${distributorName}\n`;
    message += `📅 Buyurtma sanasi: ${formatDate(order.orderDate)}\n`;
    message += `📅 Yetkazish sanasi: ${formatDate(order.deliveryDate)}\n`;
    message += `${statusEmoji} Holat: ${translateStatus(order.status)}\n\n`;

    message += `📦 **Mahsulotlar:**\n\n`;

    order.items.forEach((item, index) => {
      const quantity = item.adjustedQuantity || item.quantity;
      message += `${index + 1}. ${item.product.name}\n`;
      message += `   📊 Miqdor: ${quantity} ${item.product.unit}\n`;
      
      if (item.adjustedQuantity && item.adjustedQuantity !== item.quantity) {
        message += `   ⚠️ Dastlabki: ${item.quantity} ${item.product.unit}\n`;
        message += `   ℹ️ Sabab: ${item.adjustmentReason || 'Sabab ko\'rsatilmagan'}\n`;
      }
      message += '\n';
    });

    if (order.notes) {
      message += `📝 Izoh: ${order.notes}\n`;
    }

    // Inline keyboard
    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '🔄 Holatini o\'zgartirish', callback_data: `change_status_${orderId}` },
      ],
      [
        { text: '📝 Miqdorlarni o\'zgartirish', callback_data: `change_quantities_${orderId}` },
      ],
      [
        { text: '🗑 Buyurtmani o\'chirish', callback_data: `delete_order_${orderId}` },
      ],
      [
        { text: '🔙 Orqaga', callback_data: 'view_orders_all' },
      ],
    ];

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error('Error in handleViewOrderDetail:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// Buyurtma holatini o'zgartirish menyusi
export async function handleChangeStatus(bot: TelegramBot, chatId: number, orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const currentStatus = order.status;
    const message = `🔄 **Buyurtma holati o'zgartirish**\n\n` +
      `📋 Buyurtma: ${order.orderNumber}\n` +
      `${getStatusEmoji(currentStatus)} Joriy holat: ${translateStatus(currentStatus)}\n\n` +
      `Yangi holatni tanlang:`;

    // Barcha status'lar
    const statuses: OrderStatus[] = [
      'DRAFT',
      'SUBMITTED',
      'CONFIRMED',
      'IN_PRODUCTION',
      'READY',
      'DELIVERED',
      'CANCELLED',
    ];

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    statuses
      .filter(status => status !== currentStatus)
      .forEach(status => {
        keyboard.push([
          {
            text: `${getStatusEmoji(status)} ${translateStatus(status)}`,
            callback_data: `set_status_${orderId}_${status}`,
          },
        ]);
      });

    keyboard.push([{ text: '🔙 Orqaga', callback_data: `view_order_${orderId}` }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error('Error in handleChangeStatus:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// Buyurtma holatini o'zgartirish (tasdiqlash)
export async function handleSetStatus(
  bot: TelegramBot,
  chatId: number,
  orderId: string,
  newStatus: OrderStatus,
  userId: string
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { distributor: true },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const oldStatus = order.status;

    // Holatni o'zgartirish
    await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    // Holat tarixiga yozish
    await prisma.orderStatusHistory.create({
      data: {
        orderId: orderId,
        status: newStatus,
        changedBy: userId,
        notes: `Admin tomonidan o'zgartirildi`,
      },
    });

    // Distribyutorga notification yuborish
    await prisma.notification.create({
      data: {
        userId: order.distributorId,
        type: 'ORDER_STATUS',
        title: 'Buyurtma holati o\'zgartirildi',
        message: `${order.orderNumber} buyurtma holati ${translateStatus(oldStatus)} → ${translateStatus(newStatus)}`,
        relatedEntityType: 'order',
        relatedEntityId: orderId,
      },
    });

    const message = `✅ **Buyurtma holati o'zgartirildi!**\n\n` +
      `📋 Buyurtma: ${order.orderNumber}\n` +
      `${getStatusEmoji(oldStatus)} ${translateStatus(oldStatus)} → ${getStatusEmoji(newStatus)} ${translateStatus(newStatus)}`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${orderId}` }]],
      },
    });

    logger.info(`Order ${orderId} status changed from ${oldStatus} to ${newStatus} by user ${userId}`);
  } catch (error) {
    logger.error('Error in handleSetStatus:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// Buyurtma item'larini ko'rsatish va o'zgartirish
export async function handleChangeQuantities(bot: TelegramBot, chatId: number, orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    let message = `📝 **Miqdorlarni boshqarish**\n\n`;
    message += `📋 Buyurtma: ${order.orderNumber}\n\n`;
    message += `Qaysi mahsulot bilan ishlashni xohlaysiz?\n\n`;

    order.items.forEach((item, index) => {
      const quantity = item.adjustedQuantity || item.quantity;
      message += `${index + 1}. ${item.product.name}\n`;
      message += `   📊 Miqdor: ${quantity} ${item.product.unit}\n\n`;
    });

    // Inline keyboard - har bir item uchun ikkita tugma
    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    order.items.forEach((item) => {
      const quantity = item.adjustedQuantity || item.quantity;
      keyboard.push([
        {
          text: `${item.product.name} (${quantity} ${item.product.unit})`,
          callback_data: `change_item_${item.id}`,
        },
      ]);
    });

    keyboard.push([{ text: '🔙 Orqaga', callback_data: `view_order_${orderId}` }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error('Error in handleChangeQuantities:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// Kunlik hisobot
export async function handleDailySummary(bot: TelegramBot, chatId: number, date?: Date) {
  try {
    const targetDate = date || new Date();
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const orders = await prisma.order.findMany({
      where: {
        orderDate: {
          gte: new Date(dateStr),
          lt: new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000),
        },
        status: {
          not: 'CANCELLED',
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (orders.length === 0) {
      await bot.sendMessage(chatId, `📊 ${formatDate(targetDate)} uchun buyurtmalar topilmadi.`);
      return;
    }

    // Mahsulotlar bo'yicha summatsiya
    const productSummary: { [key: string]: { name: string; code: string; unit: string; total: number; count: number } } = {};

    orders.forEach(order => {
      order.items.forEach(item => {
        const quantity = item.adjustedQuantity || item.quantity;
        const productId = item.productId;

        if (!productSummary[productId]) {
          productSummary[productId] = {
            name: item.product.name,
            code: item.product.code,
            unit: item.product.unit,
            total: 0,
            count: 0,
          };
        }

        productSummary[productId].total += Number(quantity);
        productSummary[productId].count += 1;
      });
    });

    let message = `📊 **Kunlik Hisobot**\n\n`;
    message += `📅 Sana: ${formatDate(targetDate)}\n`;
    message += `📋 Jami buyurtmalar: ${orders.length} ta\n\n`;
    message += `📦 **Mahsulotlar:**\n\n`;

    Object.values(productSummary).forEach((item, index) => {
      message += `${index + 1}. ${item.name} (${item.code})\n`;
      message += `   📊 Jami: ${item.total} ${item.unit}\n`;
      message += `   📋 Buyurtmalar: ${item.count} ta\n\n`;
    });

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
    });
  } catch (error) {
    logger.error('Error in handleDailySummary:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// Hisobot uchun sana tanlash menyusi
export async function handleReportMenu(bot: TelegramBot, chatId: number) {
  try {
    const message = `📊 **Hisobotlar**\n\nQaysi kun uchun hisobot olmoqchisiz?`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '📅 Bugun', callback_data: 'report_today' }],
      [{ text: '📅 Kecha', callback_data: 'report_yesterday' }],
      [{ text: '📅 Boshqa sana', callback_data: 'report_custom_date' }],
      [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
    ];

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error('Error in handleReportMenu:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// Bugun uchun hisobot
export async function handleReportToday(bot: TelegramBot, chatId: number) {
  const today = new Date();
  await handleDailySummary(bot, chatId, today);
}

// Kecha uchun hisobot
export async function handleReportYesterday(bot: TelegramBot, chatId: number) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await handleDailySummary(bot, chatId, yesterday);
}

// Helper funksiyalar
function getStatusEmoji(status: OrderStatus): string {
  const emojiMap: { [key in OrderStatus]: string } = {
    DRAFT: '📝',
    SUBMITTED: '📤',
    CONFIRMED: '✅',
    IN_PRODUCTION: '🔨',
    READY: '✔️',
    DELIVERED: '🚚',
    CANCELLED: '❌',
  };
  return emojiMap[status] || '❓';
}

function translateStatus(status: OrderStatus): string {
  const translations: { [key in OrderStatus]: string } = {
    DRAFT: 'Qoralama',
    SUBMITTED: 'Yuborilgan',
    CONFIRMED: 'Tasdiqlangan',
    IN_PRODUCTION: 'Ishlab chiqarilmoqda',
    READY: 'Tayyor',
    DELIVERED: 'Yetkazilgan',
    CANCELLED: 'Bekor qilingan',
  };
  return translations[status] || status;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export async function handleDeleteItem(bot: TelegramBot, chatId: number, itemId: string, userId: string) {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: {
        product: true,
        order: {
          include: {
            distributor: true,
            items: true,
          },
        },
      },
    });

    if (!item) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    // Agar bu buyurtmadagi yagona item bo'lsa, o'chirishga ruxsat bermaslik
    if (item.order.items.length === 1) {
      await bot.sendMessage(chatId, '❌ Buyurtmada kamida bitta mahsulot bo\'lishi kerak. Bu mahsulotni o\'chirib bo\'lmaydi.');
      return;
    }

    const message =
      `⚠️ **Mahsulotni o'chirish**\n\n` +
      `📋 Buyurtma: ${item.order.orderNumber}\n` +
      `📦 Mahsulot: ${item.product.name}\n` +
      `📊 Miqdor: ${item.adjustedQuantity || item.quantity} ${item.product.unit}\n\n` +
      `Rostdan ham bu mahsulotni o'chirmoqchimisiz?`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '✅ Ha, o\'chirish', callback_data: `confirm_delete_item_${itemId}` },
        { text: '❌ Yo\'q, bekor qilish', callback_data: `view_order_${item.orderId}` },
      ],
    ];

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error('Error in handleDeleteItem:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// Order item'ni o'chirish (tasdiqlangan)
export async function handleConfirmDeleteItem(bot: TelegramBot, chatId: number, itemId: string, userId: string) {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: {
        product: true,
        order: {
          include: {
            distributor: true,
          },
        },
      },
    });

    if (!item) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    const productName = item.product.name;
    const orderNumber = item.order.orderNumber;
    const orderId = item.orderId;

    // Item'ni o'chirish
    await prisma.orderItem.delete({
      where: { id: itemId },
    });

    // Distribyutorga notification yuborish
    await prisma.notification.create({
      data: {
        userId: item.order.distributorId,
        type: 'ORDER_CHANGE',
        title: 'Buyurtmadan mahsulot o\'chirildi',
        message: `${orderNumber} buyurtmadan ${productName} mahsuloti o'chirib tashlandi.`,
        relatedEntityType: 'order',
        relatedEntityId: orderId,
      },
    });

    const successMessage =
      `✅ **Mahsulot o'chirildi!**\n\n` +
      `📦 ${productName}\n` +
      `📋 Buyurtma: ${orderNumber}\n\n` +
      `Distribyutorga xabar yuborildi.`;

    await bot.sendMessage(chatId, successMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${orderId}` }]],
      },
    });

    logger.info(`Order item ${itemId} deleted from order ${orderId} by user ${userId}`);
  } catch (error) {
    logger.error('Error in handleConfirmDeleteItem:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// Buyurtmani o'chirish (tasdiqlash)
export async function handleDeleteOrder(bot: TelegramBot, chatId: number, orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        distributor: true,
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const distributorName = order.distributor.companyName || order.distributor.name;

    let message = `⚠️ **Buyurtmani o'chirish**\n\n`;
    message += `Rostdan ham bu buyurtmani butunlay o'chirmoqchimisiz?\n\n`;
    message += `📋 Buyurtma: ${order.orderNumber}\n`;
    message += `👤 Distribyutor: ${distributorName}\n`;
    message += `${getStatusEmoji(order.status)} Holat: ${translateStatus(order.status)}\n`;
    message += `📦 Mahsulotlar: ${order.items.length} ta\n\n`;
    message += `⚠️ Bu amalni bekor qilib bo'lmaydi!`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '✅ Ha, o\'chirish', callback_data: `confirm_delete_order_${orderId}` },
        { text: '❌ Bekor qilish', callback_data: `view_order_${orderId}` },
      ],
    ];

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard,
      },
    });
  } catch (error) {
    logger.error('Error in handleDeleteOrder:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// Buyurtmani o'chirish (tasdiqlangan)
export async function handleConfirmDeleteOrder(bot: TelegramBot, chatId: number, orderId: string, userId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        distributor: true,
      },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const orderNumber = order.orderNumber;
    const distributorId = order.distributorId;

    // Order items va history'ni o'chirish (CASCADE bo'lishi kerak, lekin manual ham qilamiz)
    await prisma.orderItem.deleteMany({
      where: { orderId: orderId },
    });

    await prisma.orderStatusHistory.deleteMany({
      where: { orderId: orderId },
    });

    // Buyurtmani o'chirish
    await prisma.order.delete({
      where: { id: orderId },
    });

    // Distribyutorga notification yuborish
    await prisma.notification.create({
      data: {
        userId: distributorId,
        type: 'ORDER_CHANGE',
        title: 'Buyurtma o\'chirildi',
        message: `${orderNumber} raqamli buyurtmangiz admin tomonidan o'chirib tashlandi.`,
        relatedEntityType: 'order',
        relatedEntityId: orderId,
      },
    });

    const successMessage =
      `✅ **Buyurtma o'chirildi!**\n\n` +
      `📋 Buyurtma: ${orderNumber}\n\n` +
      `Distribyutorga xabar yuborildi.`;

    await bot.sendMessage(chatId, successMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Buyurtmalarga qaytish', callback_data: 'view_orders_all' }]],
      },
    });

    logger.info(`Order ${orderId} deleted by user ${userId}`);
  } catch (error) {
    logger.error('Error in handleConfirmDeleteOrder:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}