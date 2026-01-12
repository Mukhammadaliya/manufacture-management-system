import { Request, Response, NextFunction } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errors';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Buyurtma raqami generatsiya qilish
const generateOrderNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${year}${month}${day}-${random}`;
};

// Barcha buyurtmalarni olish
export const getAllOrders = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, startDate, endDate } = req.query;
    const user = req.user!;

    // Distribyutor faqat o'z buyurtmalarini ko'radi
    const whereCondition: any = {
      ...(status && { status: status as OrderStatus }),
      ...(startDate && endDate && {
        orderDate: {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        },
      }),
    };

    if (user.role === 'DISTRIBUTOR') {
      whereCondition.distributorId = user.id;
    }

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        distributor: {
          select: {
            id: true,
            name: true,
            companyName: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                unit: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        orders,
        count: orders.length,
      },
    });
  }
);

// Bitta buyurtmani olish
export const getOrderById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        distributor: {
          select: {
            id: true,
            name: true,
            companyName: true,
            phone: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                code: true,
                unit: true,
              },
            },
          },
        },
        statusHistory: {
          include: {
            user: {
              select: {
                name: true,
                role: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Buyurtma topilmadi');
    }

    // Distribyutor faqat o'z buyurtmasini ko'ra oladi
    if (user.role === 'DISTRIBUTOR' && order.distributorId !== user.id) {
      throw new AuthorizationError('Bu buyurtmani ko\'rishga ruxsatingiz yo\'q');
    }

    res.json({
      success: true,
      data: { order },
    });
  }
);

// Yangi buyurtma yaratish
export const createOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { orderDate, deliveryDate, items, notes } = req.body;
    const user = req.user!;

    // Distribyutor faqat o'zi uchun buyurtma yarata oladi
    const distributorId = user.role === 'DISTRIBUTOR' ? user.id : req.body.distributorId;

    if (!distributorId) {
      throw new ValidationError('Distribyutor ID talab qilinadi');
    }

    if (!items || items.length === 0) {
      throw new ValidationError('Kamida bitta mahsulot bo\'lishi kerak');
    }

    // Buyurtma raqamini yaratish
    const orderNumber = generateOrderNumber();

    // Buyurtmani yaratish
    const order = await prisma.order.create({
      data: {
        orderNumber,
        distributorId,
        orderDate: new Date(orderDate),
        deliveryDate: new Date(deliveryDate),
        status: OrderStatus.DRAFT,
        notes,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            originalQuantity: item.quantity,
            unitPrice: 0, // Keyinchalik qo'shiladi
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
        status: OrderStatus.DRAFT,
        changedBy: user.id,
        notes: 'Buyurtma yaratildi',
      },
    });

    logger.info(`Order created: ${order.orderNumber} by ${user.name}`);

    res.status(201).json({
      success: true,
      data: { order },
      message: 'Buyurtma muvaffaqiyatli yaratildi',
    });
  }
);

// Buyurtmani yangilash
export const updateOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { orderDate, deliveryDate, notes, items } = req.body;
    const user = req.user!;

    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundError('Buyurtma topilmadi');
    }

    // Distribyutor faqat DRAFT va SUBMITTED holatdagi buyurtmani o'zgartira oladi
    if (user.role === 'DISTRIBUTOR') {
      if (existingOrder.distributorId !== user.id) {
        throw new AuthorizationError('Bu buyurtmani tahrirlashga ruxsatingiz yo\'q');
      }
      if (!['DRAFT', 'SUBMITTED'].includes(existingOrder.status)) {
        throw new ValidationError('Faqat DRAFT va SUBMITTED holatdagi buyurtmalarni tahrirlash mumkin');
      }
    }

    // Buyurtmani yangilash
    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(orderDate && { orderDate: new Date(orderDate) }),
        ...(deliveryDate && { deliveryDate: new Date(deliveryDate) }),
        ...(notes && { notes }),
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    logger.info(`Order updated: ${order.orderNumber} by ${user.name}`);

    res.json({
      success: true,
      data: { order },
      message: 'Buyurtma muvaffaqiyatli yangilandi',
    });
  }
);

// Buyurtma holatini o'zgartirish
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, notes } = req.body;
    const user = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Buyurtma topilmadi');
    }

    // Buyurtma holatini yangilash
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: { status },
      include: {
        distributor: true,
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
        orderId: id,
        status,
        changedBy: user.id,
        notes: notes || `Holat ${status}ga o'zgartirildi`,
      },
    });

    logger.info(`Order status changed: ${order.orderNumber} to ${status} by ${user.name}`);

    res.json({
      success: true,
      data: { order: updatedOrder },
      message: 'Buyurtma holati muvaffaqiyatli o\'zgartirildi',
    });
  }
);

// Buyurtmani o'chirish
export const deleteOrder = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Buyurtma topilmadi');
    }

    // Faqat DRAFT holatdagi buyurtmalarni o'chirish mumkin
    if (order.status !== 'DRAFT') {
      throw new ValidationError('Faqat DRAFT holatdagi buyurtmalarni o\'chirish mumkin');
    }

    // Distribyutor faqat o'z buyurtmasini o'chira oladi
    if (user.role === 'DISTRIBUTOR' && order.distributorId !== user.id) {
      throw new AuthorizationError('Bu buyurtmani o\'chirishga ruxsatingiz yo\'q');
    }

    await prisma.order.delete({
      where: { id },
    });

    logger.info(`Order deleted: ${order.orderNumber} by ${user.name}`);

    res.json({
      success: true,
      message: 'Buyurtma muvaffaqiyatli o\'chirildi',
    });
  }
);

// Order item miqdorini o'zgartirish (Producer/Admin)
export const updateOrderItem = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { orderId, itemId } = req.params;
    const { adjustedQuantity, adjustmentReason } = req.body;
    const user = req.user!;

    // Order va item'ni tekshirish
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        distributor: {
          select: {
            id: true,
            name: true,
            telegramId: true,
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundError('Buyurtma topilmadi');
    }

    const item = order.items.find((i) => i.id === itemId);
    if (!item) {
      throw new NotFoundError('Buyurtma item topilmadi');
    }

    // Order item'ni yangilash
    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        adjustedQuantity,
        adjustmentReason,
      },
      include: {
        product: true,
      },
    });

    // Notification yaratish (Distributor uchun)
    await prisma.notification.create({
      data: {
        userId: order.distributorId,
        type: 'ORDER_CHANGE',
        title: 'Buyurtma miqdori o\'zgartirildi',
        message: `${updatedItem.product.name} mahsuloti miqdori ${item.quantity} dan ${adjustedQuantity} ga o'zgartirildi. Sabab: ${adjustmentReason}`,
        relatedEntityType: 'order',
        relatedEntityId: orderId,
      },
    });

    logger.info(
      `Order item updated: Order ${order.orderNumber}, Item ${updatedItem.product.name}, Quantity ${item.quantity} -> ${adjustedQuantity}`
    );

    res.json({
      success: true,
      data: { item: updatedItem },
      message: 'Buyurtma miqdori muvaffaqiyatli o\'zgartirildi',
    });
  }
);

// Buyurtmadagi barcha item'larni olish
export const getOrderItems = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { orderId } = req.params;
    const user = req.user!;

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
      throw new NotFoundError('Buyurtma topilmadi');
    }

    // Distributor faqat o'z buyurtmasini ko'ra oladi
    if (user.role === 'DISTRIBUTOR' && order.distributorId !== user.id) {
      throw new AuthorizationError('Bu buyurtmani ko\'rishga ruxsatingiz yo\'q');
    }

    res.json({
      success: true,
      data: {
        items: order.items,
        count: order.items.length,
      },
    });
  }
);