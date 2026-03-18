import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient, OrderStatus } from '@prisma/client';
import logger from '../../utils/logger';
import {
  formatDate,
  formatOrderNumber,
  translateStatus,
  getStatusEmoji,
  getTodayDate,
  getDateOptions,
  formatPrice,
} from '../utils/orderHelpers';

const prisma = new PrismaClient();

const ONE_DAY_MS = 86_400_000;

type OrderFilter = 'today' | 'yesterday' | 'tomorrow' | 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
type DateFilter = 'today' | 'yesterday' | 'tomorrow';
type StatusFilter = 'ALL' | 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';

// ── Internal helpers ────────────────────────────────────────────────────────

async function recalcOrderTotal(orderId: string, userId: string) {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  const total = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  await prisma.order.update({
    where: { id: orderId },
    data: { totalAmount: total, updatedBy: userId },
  });
}

async function notifyDistributor(
  bot: TelegramBot,
  distributorId: string,
  orderId: string,
  message: string
) {
  await prisma.notification.create({
    data: {
      userId: distributorId,
      type: 'ORDER_CHANGE',
      title: "Buyurtma o'zgartirildi",
      message,
      relatedEntityType: 'order',
      relatedEntityId: orderId,
    },
  });

  // Distribyutorga Telegram xabar yuborish
  try {
    const distributor = await prisma.user.findUnique({
      where: { id: distributorId },
    });
    if (distributor) {
      await bot.sendMessage(Number(distributor.telegramId), `📢 ${message}`);
    }
  } catch (e) {
    logger.warn(`Could not send Telegram notification to distributor ${distributorId}:`, e);
  }
}

// ── handleViewOrders ────────────────────────────────────────────────────────

export async function handleViewOrders(
  bot: TelegramBot,
  chatId: number,
  filter: OrderFilter
) {
  try {
    let whereCondition: any = {};

    if (filter === 'today') {
      const today = getTodayDate();
      whereCondition = {
        orderDate: { gte: today, lt: new Date(today.getTime() + ONE_DAY_MS) },
        status: { not: 'CANCELLED' },
      };
    } else if (filter === 'yesterday') {
      const today = getTodayDate();
      const yesterday = new Date(today.getTime() - ONE_DAY_MS);
      whereCondition = {
        orderDate: { gte: yesterday, lt: today },
        status: { not: 'CANCELLED' },
      };
    } else if (filter === 'tomorrow') {
      const today = getTodayDate();
      const tomorrow = new Date(today.getTime() + ONE_DAY_MS);
      whereCondition = {
        orderDate: { gte: tomorrow, lt: new Date(today.getTime() + ONE_DAY_MS * 2) },
        status: { not: 'CANCELLED' },
      };
    } else {
      // status filter: 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED'
      whereCondition = { status: filter };
    }

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        distributor: true,
        items: {
          include: { product: true },
        },
      },
      orderBy: { orderSeq: 'desc' },
      take: 20,
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

      message += `${index + 1}. ${formatOrderNumber(order.orderSeq)}\n`;
      message += `   👤 ${distributorName}\n`;
      message += `   📅 ${formatDate(order.orderDate)}\n`;
      message += `   ${statusEmoji} ${translateStatus(order.status)}\n`;
      message += `   📦 ${totalItems} ta mahsulot\n\n`;
    });

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    orders.forEach((order) => {
      keyboard.push([
        {
          text: `📋 ${formatOrderNumber(order.orderSeq)} — ${order.distributor.companyName || order.distributor.name}`,
          callback_data: `view_order_${order.id}`,
        },
      ]);
    });

    keyboard.push([{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleViewOrders:', error);
    await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.");
  }
}

// ── handleViewOrdersByDateAndStatus ──────────────────────────────────────────

export async function handleViewOrdersByDateAndStatus(
  bot: TelegramBot,
  chatId: number,
  dateFilter: DateFilter | Date,
  statusFilter: StatusFilter
) {
  try {
    const where: any = {};

    // Sana filtrini belgilash
    let targetDate: Date;
    if (dateFilter instanceof Date) {
      targetDate = dateFilter;
    } else {
      const today = getTodayDate();
      if (dateFilter === 'today') targetDate = today;
      else if (dateFilter === 'yesterday') targetDate = new Date(today.getTime() - ONE_DAY_MS);
      else targetDate = new Date(today.getTime() + ONE_DAY_MS);
    }

    where.orderDate = {
      gte: targetDate,
      lt: new Date(targetDate.getTime() + ONE_DAY_MS),
    };

    // Status filtrini belgilash
    if (statusFilter !== 'ALL') {
      where.status = statusFilter;
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        distributor: true,
        items: { include: { product: true } },
      },
      orderBy: { orderSeq: 'desc' },
      take: 20,
    });

    if (orders.length === 0) {
      await bot.sendMessage(chatId, '📋 Buyurtmalar topilmadi.', {
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'show_order_filters' }]],
        },
      });
      return;
    }

    let message = `📊 **Buyurtmalar** (${formatDate(targetDate)}):\n\n`;

    orders.forEach((order, index) => {
      const statusEmoji = getStatusEmoji(order.status);
      const distributorName = order.distributor.companyName || order.distributor.name;

      message += `${index + 1}. ${formatOrderNumber(order.orderSeq)}\n`;
      message += `   👤 ${distributorName}\n`;
      message += `   ${statusEmoji} ${translateStatus(order.status)}\n`;
      message += `   📦 ${order.items.length} ta mahsulot\n\n`;
    });

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    orders.forEach((order) => {
      keyboard.push([
        {
          text: `📋 ${formatOrderNumber(order.orderSeq)} — ${order.distributor.companyName || order.distributor.name}`,
          callback_data: `view_order_${order.id}`,
        },
      ]);
    });

    keyboard.push([{ text: '🔙 Orqaga', callback_data: 'show_order_filters' }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleViewOrdersByDateAndStatus:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleViewOrderDetail ───────────────────────────────────────────────────

export async function handleViewOrderDetail(
  bot: TelegramBot,
  chatId: number,
  orderId: string
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        distributor: true,
        items: { include: { product: true } },
      },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const statusEmoji = getStatusEmoji(order.status);
    const distributorName = order.distributor.companyName || order.distributor.name;

    let message = `📋 **Buyurtma tafsilotlari**\n\n`;
    message += `🔢 Raqam: ${formatOrderNumber(order.orderSeq)}\n`;
    message += `👤 Distribyutor: ${distributorName}\n`;
    message += `📅 Buyurtma sanasi: ${formatDate(order.orderDate)}\n`;
    message += `${statusEmoji} Holat: ${translateStatus(order.status)}\n\n`;

    message += `📦 **Mahsulotlar:**\n\n`;

    order.items.forEach((item, index) => {
      message += `${index + 1}. ${item.product.name}\n`;
      message += `   📊 Miqdor: ${item.quantity} ${item.product.unit}\n`;
      message += `   💰 Narx: ${formatPrice(item.unitPrice)}\n`;
      message += `   💵 Jami: ${formatPrice(item.totalPrice)}\n`;
      message += '\n';
    });

    message += `\n💰 Jami: ${formatPrice(order.totalAmount)}`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    // Action buttons based on status
    if (order.status === 'DRAFT') {
      keyboard.push([
        { text: '✅ Tasdiqlash', callback_data: `set_status_${orderId}_CONFIRMED` },
        { text: '❌ Bekor qilish', callback_data: `set_status_${orderId}_CANCELLED` },
      ]);
    } else if (order.status === 'CONFIRMED') {
      keyboard.push([
        { text: '📦 Yetkazildi', callback_data: `set_status_${orderId}_DELIVERED` },
        { text: '❌ Bekor qilish', callback_data: `set_status_${orderId}_CANCELLED` },
      ]);
    }
    // DELIVERED / CANCELLED — no action buttons

    // Edit button for DRAFT or CONFIRMED
    if (order.status === 'DRAFT' || order.status === 'CONFIRMED') {
      keyboard.push([
        { text: '✏️ Tahrirlash', callback_data: `edit_order_menu_${orderId}` },
      ]);
    }

    keyboard.push([
      { text: '🗑 Buyurtmani o\'chirish', callback_data: `delete_order_${orderId}` },
    ]);
    keyboard.push([
      { text: '🔙 Orqaga', callback_data: 'view_orders_today' },
    ]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleViewOrderDetail:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleEditOrderMenu ─────────────────────────────────────────────────────

export async function handleEditOrderMenu(
  bot: TelegramBot,
  chatId: number,
  orderId: string
) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const message =
      `✏️ **Buyurtmani tahrirlash**\n\n` +
      `📋 Buyurtma: ${formatOrderNumber(order.orderSeq)}\n\n` +
      `Nimani o'zgartirmoqchisiz?`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [{ text: '📅 Sana', callback_data: `edit_date_${orderId}` }],
      [{ text: '📊 Miqdorlar', callback_data: `edit_quantities_${orderId}` }],
      [{ text: '💰 Narxlar', callback_data: `edit_prices_${orderId}` }],
      [{ text: '🔙 Orqaga', callback_data: `view_order_${orderId}` }],
    ];

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleEditOrderMenu:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleEditDate ──────────────────────────────────────────────────────────

export async function handleEditDate(
  bot: TelegramBot,
  chatId: number,
  orderId: string
) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const message =
      `📅 **Sanani o'zgartirish**\n\n` +
      `📋 Buyurtma: ${formatOrderNumber(order.orderSeq)}\n` +
      `Joriy sana: ${formatDate(order.orderDate)}\n\n` +
      `Yangi sanani tanlang:`;

    const dateOptions = getDateOptions();

    const keyboard: TelegramBot.InlineKeyboardButton[][] = dateOptions.map((opt) => [
      {
        text: opt.label,
        callback_data: `set_date_${orderId}_${opt.date.toISOString().slice(0, 10)}`,
      },
    ]);

    keyboard.push([
      { text: '📅 Boshqa sana', callback_data: `set_date_custom_${orderId}` },
    ]);
    keyboard.push([{ text: '🔙 Orqaga', callback_data: `edit_order_menu_${orderId}` }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleEditDate:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleEditQuantities ────────────────────────────────────────────────────

export async function handleEditQuantities(
  bot: TelegramBot,
  chatId: number,
  orderId: string
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const message =
      `📊 **Miqdorlarni tahrirlash**\n\n` +
      `📋 Buyurtma: ${formatOrderNumber(order.orderSeq)}\n\n` +
      `Qaysi mahsulot miqdorini o'zgartirmoqchisiz?`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = order.items.map((item) => [
      {
        text: `${item.product.name} (${item.quantity} ${item.product.unit})`,
        callback_data: `edit_item_qty_${item.id}`,
      },
    ]);

    keyboard.push([{ text: '🔙 Orqaga', callback_data: `edit_order_menu_${orderId}` }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleEditQuantities:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleEditPrices ────────────────────────────────────────────────────────

export async function handleEditPrices(
  bot: TelegramBot,
  chatId: number,
  orderId: string
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const message =
      `💰 **Narxlarni tahrirlash**\n\n` +
      `📋 Buyurtma: ${formatOrderNumber(order.orderSeq)}\n\n` +
      `Qaysi mahsulot narxini o'zgartirmoqchisiz?`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = order.items.map((item) => [
      {
        text: `${item.product.name} — ${formatPrice(item.unitPrice)}`,
        callback_data: `edit_item_price_${item.id}`,
      },
    ]);

    keyboard.push([{ text: '🔙 Orqaga', callback_data: `edit_order_menu_${orderId}` }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleEditPrices:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleUpdateItemQty ─────────────────────────────────────────────────────

export async function handleUpdateItemQty(
  bot: TelegramBot,
  chatId: number,
  itemId: string,
  orderId: string,
  newQty: number,
  userId: string
) {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { product: true, order: { include: { distributor: true } } },
    });

    if (!item) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    const newTotalPrice = newQty * Number(item.unitPrice);

    await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        quantity: newQty,
        totalPrice: newTotalPrice,
        updatedBy: userId,
      },
    });

    await recalcOrderTotal(orderId, userId);

    await notifyDistributor(
      bot,
      item.order.distributorId,
      orderId,
      `${formatOrderNumber(item.order.orderSeq)} buyurtmadagi ${item.product.name} miqdori ${newQty} ${item.product.unit} ga o'zgartirildi.`
    );

    await bot.sendMessage(
      chatId,
      `✅ Miqdor yangilandi: ${item.product.name} — ${newQty} ${item.product.unit}`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${orderId}` }]],
        },
      }
    );

    logger.info(`Item ${itemId} qty updated to ${newQty} by user ${userId}`);
  } catch (error) {
    logger.error('Error in handleUpdateItemQty:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleUpdateItemPrice ───────────────────────────────────────────────────

export async function handleUpdateItemPrice(
  bot: TelegramBot,
  chatId: number,
  itemId: string,
  orderId: string,
  newPrice: number,
  userId: string
) {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { product: true, order: { include: { distributor: true } } },
    });

    if (!item) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    const qty = Number(item.quantity);
    const newTotalPrice = qty * newPrice;

    await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        unitPrice: newPrice,
        totalPrice: newTotalPrice,
        updatedBy: userId,
      },
    });

    await recalcOrderTotal(orderId, userId);

    await notifyDistributor(
      bot,
      item.order.distributorId,
      orderId,
      `${formatOrderNumber(item.order.orderSeq)} buyurtmadagi ${item.product.name} narxi ${formatPrice(newPrice)} ga o'zgartirildi.`
    );

    await bot.sendMessage(
      chatId,
      `✅ Narx yangilandi: ${item.product.name} — ${formatPrice(newPrice)}`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${orderId}` }]],
        },
      }
    );

    logger.info(`Item ${itemId} price updated to ${newPrice} by user ${userId}`);
  } catch (error) {
    logger.error('Error in handleUpdateItemPrice:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleSetDate ───────────────────────────────────────────────────────────

export async function handleSetDate(
  bot: TelegramBot,
  chatId: number,
  orderId: string,
  dateStr: string,
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

    const newDate = new Date(dateStr);

    await prisma.order.update({
      where: { id: orderId },
      data: { orderDate: newDate, updatedBy: userId },
    });

    await notifyDistributor(
      bot,
      order.distributorId,
      orderId,
      `${formatOrderNumber(order.orderSeq)} buyurtma sanasi ${formatDate(newDate)} ga o'zgartirildi.`
    );

    await bot.sendMessage(
      chatId,
      `✅ Sana yangilandi: ${formatDate(newDate)}`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${orderId}` }]],
        },
      }
    );

    logger.info(`Order ${orderId} date updated to ${dateStr} by user ${userId}`);
  } catch (error) {
    logger.error('Error in handleSetDate:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleChangeStatus (backward compat) ───────────────────────────────────

export async function handleChangeStatus(
  bot: TelegramBot,
  chatId: number,
  orderId: string
) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const currentStatus = order.status;
    const message =
      `🔄 **Buyurtma holati o'zgartirish**\n\n` +
      `📋 Buyurtma: ${formatOrderNumber(order.orderSeq)}\n` +
      `${getStatusEmoji(currentStatus)} Joriy holat: ${translateStatus(currentStatus)}\n\n` +
      `Yangi holatni tanlang:`;

    const statuses: OrderStatus[] = [
      'DRAFT',
      'CONFIRMED',
      'DELIVERED',
      'CANCELLED',
    ];

    const keyboard: TelegramBot.InlineKeyboardButton[][] = statuses
      .filter((s) => s !== currentStatus)
      .map((s) => [
        {
          text: `${getStatusEmoji(s)} ${translateStatus(s)}`,
          callback_data: `set_status_${orderId}_${s}`,
        },
      ]);

    keyboard.push([{ text: '🔙 Orqaga', callback_data: `view_order_${orderId}` }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleChangeStatus:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleSetStatus ─────────────────────────────────────────────────────────

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

    await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus, updatedBy: userId },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId,
        status: newStatus,
        changedBy: userId,
        notes: "Admin tomonidan o'zgartirildi",
      },
    });

    // Notify distributor via DB notification (ORDER_STATUS)
    await prisma.notification.create({
      data: {
        userId: order.distributorId,
        type: 'ORDER_STATUS',
        title: "Buyurtma holati o'zgartirildi",
        message: `${formatOrderNumber(order.orderSeq)} buyurtma holati ${translateStatus(oldStatus)} → ${translateStatus(newStatus)}`,
        relatedEntityType: 'order',
        relatedEntityId: orderId,
      },
    });

    // Distribyutorga Telegram xabar yuborish
    try {
      const distributor = order.distributor;
      const telegramMsg =
        `📢 Buyurtma holati o'zgartirildi!\n\n` +
        `🔢 ${formatOrderNumber(order.orderSeq)}\n` +
        `${getStatusEmoji(oldStatus)} ${translateStatus(oldStatus)} → ${getStatusEmoji(newStatus)} ${translateStatus(newStatus)}`;
      await bot.sendMessage(Number(distributor.telegramId), telegramMsg);
    } catch (e) {
      logger.warn(`Could not send Telegram notification to distributor ${order.distributorId}:`, e);
    }

    const message =
      `✅ **Buyurtma holati o'zgartirildi!**\n\n` +
      `📋 Buyurtma: ${formatOrderNumber(order.orderSeq)}\n` +
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

// ── handleDailySummary ──────────────────────────────────────────────────────

export async function handleDailySummary(
  bot: TelegramBot,
  chatId: number,
  date?: Date
) {
  try {
    const targetDate = date || getTodayDate();
    const start = new Date(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate()
    );
    const end = new Date(start.getTime() + ONE_DAY_MS);

    const orders = await prisma.order.findMany({
      where: {
        orderDate: { gte: start, lt: end },
        status: { not: 'CANCELLED' },
      },
      include: { items: { include: { product: true } } },
    });

    if (orders.length === 0) {
      await bot.sendMessage(chatId, `📊 ${formatDate(targetDate)} uchun buyurtmalar topilmadi.`);
      return;
    }

    const productSummary: {
      [key: string]: { name: string; code: string; unit: string; total: number; count: number };
    } = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const quantity = item.quantity;
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

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error in handleDailySummary:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleReportMenu ────────────────────────────────────────────────────────

export async function handleReportMenu(bot: TelegramBot, chatId: number) {
  await bot.sendMessage(chatId, '📈 Hisobotlar:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📅 Bugun', callback_data: 'report_today' },
          { text: '📅 Kecha', callback_data: 'report_yesterday' },
        ],
        [{ text: '📅 Boshqa sana', callback_data: 'report_custom_date' }],
        [{ text: '📊 Kengaytirilgan (Excel)', callback_data: 'report_excel_start' }],
        [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
      ],
    },
  });
}

// ── handleReportToday / handleReportYesterday ───────────────────────────────

export async function handleReportToday(bot: TelegramBot, chatId: number) {
  await handleDailySummary(bot, chatId, getTodayDate());
}

export async function handleReportYesterday(bot: TelegramBot, chatId: number) {
  const today = getTodayDate();
  const yesterday = new Date(today.getTime() - ONE_DAY_MS);
  await handleDailySummary(bot, chatId, yesterday);
}

// ── handleDeleteItem ────────────────────────────────────────────────────────

export async function handleDeleteItem(
  bot: TelegramBot,
  chatId: number,
  itemId: string,
  userId: string
) {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: {
        product: true,
        order: { include: { distributor: true, items: true } },
      },
    });

    if (!item) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    if (item.order.items.length === 1) {
      await bot.sendMessage(
        chatId,
        "❌ Buyurtmada kamida bitta mahsulot bo'lishi kerak. Bu mahsulotni o'chirib bo'lmaydi."
      );
      return;
    }

    const message =
      `⚠️ **Mahsulotni o'chirish**\n\n` +
      `📋 Buyurtma: ${formatOrderNumber(item.order.orderSeq)}\n` +
      `📦 Mahsulot: ${item.product.name}\n` +
      `📊 Miqdor: ${item.quantity} ${item.product.unit}\n\n` +
      `Rostdan ham bu mahsulotni o'chirmoqchimisiz?`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: "✅ Ha, o'chirish", callback_data: `confirm_delete_item_${itemId}` },
        { text: "❌ Yo'q, bekor qilish", callback_data: `view_order_${item.orderId}` },
      ],
    ];

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleDeleteItem:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleConfirmDeleteItem ─────────────────────────────────────────────────

export async function handleConfirmDeleteItem(
  bot: TelegramBot,
  chatId: number,
  itemId: string,
  userId: string
) {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { product: true, order: { include: { distributor: true } } },
    });

    if (!item) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    const productName = item.product.name;
    const orderSeq = item.order.orderSeq;
    const orderId = item.orderId;

    await prisma.orderItem.delete({ where: { id: itemId } });
    await recalcOrderTotal(orderId, userId);

    await notifyDistributor(
      bot,
      item.order.distributorId,
      orderId,
      `${formatOrderNumber(orderSeq)} buyurtmadan ${productName} mahsuloti o'chirib tashlandi.`
    );

    const successMessage =
      `✅ **Mahsulot o'chirildi!**\n\n` +
      `📦 ${productName}\n` +
      `📋 Buyurtma: ${formatOrderNumber(orderSeq)}\n\n` +
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

// ── handleDeleteOrder ───────────────────────────────────────────────────────

export async function handleDeleteOrder(
  bot: TelegramBot,
  chatId: number,
  orderId: string
) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { distributor: true, items: { include: { product: true } } },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const distributorName = order.distributor.companyName || order.distributor.name;

    let message = `⚠️ **Buyurtmani o'chirish**\n\n`;
    message += `Rostdan ham bu buyurtmani butunlay o'chirmoqchimisiz?\n\n`;
    message += `📋 Buyurtma: ${formatOrderNumber(order.orderSeq)}\n`;
    message += `👤 Distribyutor: ${distributorName}\n`;
    message += `${getStatusEmoji(order.status)} Holat: ${translateStatus(order.status)}\n`;
    message += `📦 Mahsulotlar: ${order.items.length} ta\n\n`;
    message += `⚠️ Bu amalni bekor qilib bo'lmaydi!`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: "✅ Ha, o'chirish", callback_data: `confirm_delete_order_${orderId}` },
        { text: '❌ Bekor qilish', callback_data: `view_order_${orderId}` },
      ],
    ];

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handleDeleteOrder:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleConfirmDeleteOrder ────────────────────────────────────────────────

export async function handleConfirmDeleteOrder(
  bot: TelegramBot,
  chatId: number,
  orderId: string,
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

    const orderSeq = order.orderSeq;
    const distributorId = order.distributorId;

    await prisma.orderItem.deleteMany({ where: { orderId } });
    await prisma.orderStatusHistory.deleteMany({ where: { orderId } });
    await prisma.order.delete({ where: { id: orderId } });

    await notifyDistributor(
      bot,
      distributorId,
      orderId,
      `${formatOrderNumber(orderSeq)} raqamli buyurtmangiz admin tomonidan o'chirib tashlandi.`
    );

    const successMessage =
      `✅ **Buyurtma o'chirildi!**\n\n` +
      `📋 Buyurtma: ${formatOrderNumber(orderSeq)}\n\n` +
      `Distribyutorga xabar yuborildi.`;

    await bot.sendMessage(chatId, successMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Buyurtmalarga qaytish', callback_data: 'view_orders_today' }]],
      },
    });

    logger.info(`Order ${orderId} deleted by user ${userId}`);
  } catch (error) {
    logger.error('Error in handleConfirmDeleteOrder:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handlePendingUsers ──────────────────────────────────────────────────────

export async function handlePendingUsers(bot: TelegramBot, chatId: number) {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { isActive: false },
      orderBy: { createdAt: 'desc' },
    });

    if (pendingUsers.length === 0) {
      await bot.sendMessage(chatId, '✅ Barcha foydalanuvchilar tasdiqlangan.');
      return;
    }

    let message = '👥 **Tasdiqlanmagan Foydalanuvchilar:**\n\n';

    pendingUsers.forEach((user, index) => {
      const roleText = user.role === 'DISTRIBUTOR' ? '📦 Distribyutor' : '🔨 Ishlab chiqaruvchi';
      message += `${index + 1}. ${roleText}\n`;
      message += `   👤 Ism: ${user.name}\n`;
      message += `   📞 Telefon: ${user.phone || "Ko'rsatilmagan"}\n`;
      if (user.companyName) {
        message += `   🏢 Kompaniya: ${user.companyName}\n`;
      }
      message += `   📅 Sana: ${formatDate(user.createdAt)}\n\n`;
    });

    const keyboard: TelegramBot.InlineKeyboardButton[][] = pendingUsers.map((user) => {
      const roleEmoji = user.role === 'DISTRIBUTOR' ? '📦' : '🔨';
      return [
        {
          text: `${roleEmoji} ${user.name}`,
          callback_data: `pending_user_${user.id}`,
        },
      ];
    });

    keyboard.push([{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]);

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handlePendingUsers:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handlePendingUserDetail ─────────────────────────────────────────────────

export async function handlePendingUserDetail(
  bot: TelegramBot,
  chatId: number,
  userId: string
) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      await bot.sendMessage(chatId, '❌ Foydalanuvchi topilmadi.');
      return;
    }

    const roleText = user.role === 'DISTRIBUTOR' ? '📦 Distribyutor' : '🔨 Ishlab chiqaruvchi';

    let message = `👤 **Foydalanuvchi Ma'lumotlari**\n\n`;
    message += `${roleText}\n\n`;
    message += `👤 Ism: ${user.name}\n`;
    message += `📞 Telefon: ${user.phone || "Ko'rsatilmagan"}\n`;

    if (user.companyName) {
      message += `🏢 Kompaniya: ${user.companyName}\n`;
    }

    message += `📅 Ro'yxatdan o'tgan: ${formatDate(user.createdAt)}\n`;
    message += `📱 Telegram ID: ${user.telegramId}\n`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [
      [
        { text: '✅ Tasdiqlash', callback_data: `approve_user_${userId}` },
        { text: '❌ Rad etish', callback_data: `reject_user_${userId}` },
      ],
      [{ text: '🔙 Orqaga', callback_data: 'pending_users' }],
    ];

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('Error in handlePendingUserDetail:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleApproveUser ───────────────────────────────────────────────────────

export async function handleApproveUser(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  approverName: string
) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      await bot.sendMessage(chatId, '❌ Foydalanuvchi topilmadi.');
      return;
    }

    await prisma.user.update({ where: { id: userId }, data: { isActive: true } });

    logger.info(`User approved: ${user.telegramId} by ${approverName}`);

    try {
      await bot.sendMessage(
        Number(user.telegramId),
        `✅ **Tabriklaymiz!**\n\n` +
          `Sizning arizangiz tasdiqlandi.\n` +
          `Endi botdan to'liq foydalanishingiz mumkin.\n\n` +
          `Asosiy menyuni ochish uchun /start buyrug'ini yuboring.`
      );
    } catch (notifyError) {
      logger.warn(`Could not notify user ${user.telegramId}:`, notifyError);
    }

    await bot.sendMessage(chatId, `✅ Foydalanuvchi **${user.name}** muvaffaqiyatli tasdiqlandi.`, {
      parse_mode: 'Markdown',
    });

    await handlePendingUsers(bot, chatId);
  } catch (error) {
    logger.error('Error in handleApproveUser:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── handleRejectUser ────────────────────────────────────────────────────────

export async function handleRejectUser(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  rejecterName: string
) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      await bot.sendMessage(chatId, '❌ Foydalanuvchi topilmadi.');
      return;
    }

    await prisma.user.delete({ where: { id: userId } });

    logger.info(`User rejected: ${user.telegramId} by ${rejecterName}`);

    try {
      await bot.sendMessage(
        Number(user.telegramId),
        `❌ **Afsuski**\n\n` +
          `Sizning arizangiz rad etildi.\n\n` +
          `Qo'shimcha ma'lumot uchun bizga murojaat qiling:\n` +
          `📞 Aloqa: \`+998887011942\``,
        { parse_mode: 'Markdown' }
      );
    } catch (notifyError) {
      logger.warn(`Could not notify user ${user.telegramId}:`, notifyError);
    }

    await bot.sendMessage(chatId, `❌ Foydalanuvchi **${user.name}** rad etildi.`, {
      parse_mode: 'Markdown',
    });

    await handlePendingUsers(bot, chatId);
  } catch (error) {
    logger.error('Error in handleRejectUser:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

// ── Backward-compat alias ───────────────────────────────────────────────────

/** @deprecated Use handleEditQuantities instead */
export const handleChangeQuantities = handleEditQuantities;
