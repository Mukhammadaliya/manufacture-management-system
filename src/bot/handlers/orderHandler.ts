import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';

const prisma = new PrismaClient();

interface OrderSession {
  userId: string;
  step: 'selecting_products' | 'entering_quantity' | 'selecting_dates' | 'notes';
  items: Array<{ productId: string; productName: string; quantity: number }>;
  orderDate?: Date;
  deliveryDate?: Date;
  notes?: string;
}

// Buyurtma sessiyalarini saqlash (xotirada)
const orderSessions = new Map<number, OrderSession>();

// Yangi buyurtma boshlash
export const startNewOrder = async (bot: TelegramBot, chatId: number, userId: string) => {
  try {
    // Mahsulotlarni olish
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) {
      bot.sendMessage(chatId, '❌ Hozirda mavjud mahsulotlar yo\'q.');
      return;
    }

    // Session yaratish
    orderSessions.set(chatId, {
      userId,
      step: 'selecting_products',
      items: [],
    });

    // Mahsulotlarni inline keyboard sifatida ko'rsatish
    const keyboard = products.map((product) => [
      {
        text: `${product.name} (${product.code})`,
        callback_data: `select_product:${product.id}`,
      },
    ]);

    keyboard.push([{ text: '✅ Buyurtmani tasdiqlash', callback_data: 'confirm_order' }]);
    keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

    bot.sendMessage(
      chatId,
      `📦 Yangi Buyurtma

Mahsulot tanlang:`,
      {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      }
    );
  } catch (error) {
    logger.error('Error in startNewOrder:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi. Qayta urinib ko\'ring.');
  }
};

// Mahsulot tanlash
export const selectProduct = async (
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  productId: string
) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session) {
      bot.sendMessage(chatId, '❌ Sessiya topilmadi. /start dan boshlang.');
      return;
    }

    // Mahsulot ma'lumotlarini olish
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    // Miqdor so'rash
    session.step = 'entering_quantity';
    session.items.push({
      productId: product.id,
      productName: product.name,
      quantity: 0,
    });

    bot.editMessageText(
      `📦 Mahsulot tanlandi: ${product.name}

🔢 Miqdorni kiriting (${product.unit}):`,
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }],
          ],
        },
      }
    );

    orderSessions.set(chatId, session);
  } catch (error) {
    logger.error('Error in selectProduct:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

// Miqdor kiritish
export const enterQuantity = async (
  bot: TelegramBot,
  chatId: number,
  quantity: number
) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session || session.step !== 'entering_quantity') {
      return;
    }

    // Oxirgi item'ga miqdor qo'shish
    const lastItem = session.items[session.items.length - 1];
    lastItem.quantity = quantity;

    // Mahsulotlarni olish
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    // Tanlangan mahsulotlarni ko'rsatish
    let itemsList = '📋 Tanlangan mahsulotlar:\n\n';
    session.items.forEach((item, index) => {
      itemsList += `${index + 1}. ${item.productName} - ${item.quantity} dona\n`;
    });

    // Inline keyboard yaratish
    const keyboard = products
      .filter((p) => !session.items.find((i) => i.productId === p.id))
      .map((product) => [
        {
          text: `${product.name} (${product.code})`,
          callback_data: `select_product:${product.id}`,
        },
      ]);

    keyboard.push([{ text: '✅ Buyurtmani tasdiqlash', callback_data: 'confirm_order' }]);
    keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

    session.step = 'selecting_products';
    orderSessions.set(chatId, session);

    bot.sendMessage(
      chatId,
      `${itemsList}

Yana mahsulot qo'shishingiz yoki buyurtmani tasdiqlashingiz mumkin:`,
      {
        reply_markup: {
          inline_keyboard: keyboard,
        },
      }
    );
  } catch (error) {
    logger.error('Error in enterQuantity:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

// Buyurtmani tasdiqlash
export const confirmOrder = async (bot: TelegramBot, chatId: number) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session || session.items.length === 0) {
      bot.sendMessage(chatId, '❌ Buyurtmada mahsulotlar yo\'q.');
      return;
    }

    // Sanalarni so'rash
    bot.sendMessage(
      chatId,
      `📅 Buyurtma sanasini kiriting (format: YYYY-MM-DD):

Masalan: 2026-01-11`
    );

    session.step = 'selecting_dates';
    orderSessions.set(chatId, session);
  } catch (error) {
    logger.error('Error in confirmOrder:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

// Sana kiritish
export const enterDate = async (bot: TelegramBot, chatId: number, dateStr: string) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session || session.step !== 'selecting_dates') {
      return;
    }

    // Sanani parse qilish
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      bot.sendMessage(chatId, '❌ Noto\'g\'ri sana formati. Qayta kiriting (YYYY-MM-DD):');
      return;
    }

    if (!session.orderDate) {
      session.orderDate = date;
      bot.sendMessage(chatId, '📅 Yetkazib berish sanasini kiriting (format: YYYY-MM-DD):');
    } else {
      session.deliveryDate = date;

      // Buyurtmani yaratish
      await createOrder(bot, chatId, session);
    }

    orderSessions.set(chatId, session);
  } catch (error) {
    logger.error('Error in enterDate:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

// Buyurtmani database'ga saqlash
const createOrder = async (
  bot: TelegramBot,
  chatId: number,
  session: OrderSession
) => {
  try {
    // Buyurtma raqamini generatsiya qilish
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    const orderNumber = `ORD-${year}${month}${day}-${random}`;

    // Buyurtma yaratish
    const order = await prisma.order.create({
      data: {
        orderNumber,
        distributorId: session.userId,
        orderDate: session.orderDate!,
        deliveryDate: session.deliveryDate!,
        status: 'DRAFT',
        notes: session.notes,
        items: {
          create: session.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            originalQuantity: item.quantity,
            unitPrice: 0,
            totalPrice: 0,
          })),
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

    // Status history yaratish
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'DRAFT',
        changedBy: session.userId,
        notes: 'Buyurtma yaratildi (Telegram bot)',
      },
    });

    // Xabar yuborish
    let orderDetails = `✅ Buyurtma muvaffaqiyatli yaratildi!

📋 Buyurtma raqami: ${order.orderNumber}
📅 Buyurtma sanasi: ${order.orderDate.toLocaleDateString()}
📅 Yetkazish sanasi: ${order.deliveryDate.toLocaleDateString()}
📊 Status: ${order.status}

📦 Mahsulotlar:
`;

    order.items.forEach((item, index) => {
      orderDetails += `${index + 1}. ${item.product.name} - ${item.quantity} ${item.product.unit}\n`;
    });

    bot.sendMessage(chatId, orderDetails, {
      reply_markup: {
        keyboard: [
          [{ text: '📦 Yangi buyurtma' }, { text: '📋 Mening buyurtmalarim' }],
          [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
          [{ text: '❓ Yordam' }],
        ],
        resize_keyboard: true,
      },
    });

    // Session'ni tozalash
    orderSessions.delete(chatId);

    logger.info(`Order created via Telegram: ${order.orderNumber}`);
  } catch (error) {
    logger.error('Error creating order:', error);
    bot.sendMessage(chatId, '❌ Buyurtma yaratishda xatolik yuz berdi. Qayta urinib ko\'ring.');
  }
};

// Buyurtmani bekor qilish
export const cancelOrder = (bot: TelegramBot, chatId: number) => {
  orderSessions.delete(chatId);
  bot.sendMessage(chatId, '❌ Buyurtma bekor qilindi.', {
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

// Sessiyani olish
export const getOrderSession = (chatId: number) => {
  return orderSessions.get(chatId);
};

// Foydalanuvchining buyurtmalarini ko'rish
export const viewMyOrders = async (bot: TelegramBot, chatId: number, userId: string) => {
  try {
    const orders = await prisma.order.findMany({
      where: {
        distributorId: userId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10, // Oxirgi 10 ta buyurtma
    });

    if (orders.length === 0) {
      bot.sendMessage(chatId, '📋 Sizda hali buyurtmalar yo\'q.');
      return;
    }

    let message = '📋 Mening Buyurtmalarim:\n\n';

    const statusEmoji: { [key: string]: string } = {
      DRAFT: '📝',
      SUBMITTED: '📤',
      CONFIRMED: '✅',
      IN_PRODUCTION: '🔨',
      READY: '✅',
      DELIVERED: '📦',
      CANCELLED: '❌',
    };

    orders.forEach((order, index) => {
      const emoji = statusEmoji[order.status] || '📋';

      message += `${index + 1}. ${emoji} ${order.orderNumber}\n`;
      message += `   📅 ${order.orderDate.toLocaleDateString()}\n`;
      message += `   📊 ${order.status}\n`;
      message += `   📦 Mahsulotlar: ${order.items.length} ta\n\n`;
    });

    bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
        ],
      },
    });
  } catch (error) {
    logger.error('Error in viewMyOrders:', error);
    bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};