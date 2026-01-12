import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient, OrderStatus } from '@prisma/client';
import logger from '../../utils/logger';

const prisma = new PrismaClient();

// Barcha buyurtmalarni ko'rish (Producer/Admin)
export const viewAllOrders = async (
  bot: TelegramBot,
  chatId: number,
  filter?: string
) => {
  try {
    let whereCondition: any = {};

    // Filter bo'yicha
    if (filter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      whereCondition.orderDate = {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };
    } else if (filter === 'pending') {
      whereCondition.status = {
        in: ['SUBMITTED', 'CONFIRMED'],
      };
    }

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        distributor: {
          select: {
            name: true,
            companyName: true,
          },
        },
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    if (orders.length === 0) {
      bot.sendMessage(chatId, '📋 Buyurtmalar yo\'q.');
      return;
    }

    const statusEmoji: { [key: string]: string } = {
      DRAFT: '📝',
      SUBMITTED: '📤',
      CONFIRMED: '✅',
      IN_PRODUCTION: '🔨',
      READY: '✅',
      DELIVERED: '📦',
      CANCELLED: '❌',
    };

    let message = `📊 Buyurtmalar (${orders.length} ta):\n\n`;

    orders.forEach((order, index) => {
      const emoji = statusEmoji[order.status] || '📋';
      message += `${index + 1}. ${emoji} ${order.orderNumber}\n`;
      message += `   👤 ${order.distributor.name}`;
      if (order.distributor.companyName) {
        message += ` (${order.distributor.companyName})`;
      }
      message += `\n`;
      message += `   📅 ${order.orderDate.toLocaleDateString()}\n`;
      message += `   📊 ${order.status}\n`;
      message += `   📦 ${order.items.length} ta mahsulot\n\n`;
    });

    bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📅 Bugungi', callback_data: 'orders_today' },
            { text: '⏳ Kutilmoqda', callback_data: 'orders_pending' },
          ],
          [{ text: '🔄 Barchasi', callback_data: 'orders_all' }],
          [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
        ],
      },
    });
  } catch (error) {
    logger.error('Error in viewAllOrders:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

// Buyurtma holatini o'zgartirish
export const changeOrderStatus = async (
  bot: TelegramBot,
  chatId: number,
  orderId: string,
  newStatus: OrderStatus,
  userId: string
) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        distributor: true,
      },
    });

    if (!order) {
      bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    // Order'ni yangilash
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });

    // Status history yaratish
    await prisma.orderStatusHistory.create({
      data: {
        orderId: orderId,
        status: newStatus,
        changedBy: userId,
        notes: `Holat ${newStatus}ga o'zgartirildi (Telegram bot)`,
      },
    });

    // Distributor'ga notification yuborish
    await prisma.notification.create({
      data: {
        userId: order.distributorId,
        type: 'ORDER_STATUS',
        title: 'Buyurtma holati o\'zgartirildi',
        message: `${order.orderNumber} buyurtma holati ${newStatus}ga o'zgartirildi`,
        relatedEntityType: 'order',
        relatedEntityId: orderId,
      },
    });

    bot.sendMessage(
      chatId,
      `✅ Buyurtma ${order.orderNumber} holati ${newStatus}ga o'zgartirildi.`
    );

    logger.info(`Order status changed: ${order.orderNumber} to ${newStatus}`);
  } catch (error) {
    logger.error('Error in changeOrderStatus:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

// Kunlik hisobot
export const getDailySummary = async (bot: TelegramBot, chatId: number) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    // Bugungi buyurtmalar
    const orders = await prisma.order.findMany({
      where: {
        orderDate: {
          gte: today,
          lt: tomorrow,
        },
        status: {
          notIn: ['CANCELLED'],
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
      bot.sendMessage(chatId, '📊 Bugun buyurtmalar yo\'q.');
      return;
    }

    // Mahsulot bo'yicha umumiy miqdor
    const productSummary: { [key: string]: any } = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const quantity = item.adjustedQuantity || item.quantity;
        const productKey = item.product.code;

        if (!productSummary[productKey]) {
          productSummary[productKey] = {
            name: item.product.name,
            code: item.product.code,
            unit: item.product.unit,
            totalQuantity: 0,
            orderCount: 0,
          };
        }

        productSummary[productKey].totalQuantity += parseFloat(quantity.toString());
        productSummary[productKey].orderCount += 1;
      });
    });

    const summary = Object.values(productSummary);

    let message = `📊 Kunlik Hisobot (${today.toLocaleDateString()})\n\n`;
    message += `📋 Jami buyurtmalar: ${orders.length} ta\n\n`;
    message += `📦 Mahsulotlar:\n\n`;

    summary.forEach((item: any, index) => {
      message += `${index + 1}. ${item.name} (${item.code})\n`;
      message += `   📊 Jami: ${item.totalQuantity} ${item.unit}\n`;
      message += `   📋 Buyurtmalar: ${item.orderCount} ta\n\n`;
    });

    bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]],
      },
    });
  } catch (error) {
    logger.error('Error in getDailySummary:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};