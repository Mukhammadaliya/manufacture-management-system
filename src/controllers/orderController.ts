import { Request, Response, NextFunction } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errors';
import logger from '../utils/logger';

const prisma = new PrismaClient();

const VALID_STATUSES: OrderStatus[] = [
  OrderStatus.DRAFT,
  OrderStatus.CONFIRMED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

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
    const { orderDate, items } = req.body;
    const user = req.user!;

    // Distribyutor faqat o'zi uchun buyurtma yarata oladi
    const distributorId = user.role === 'DISTRIBUTOR' ? user.id : req.body.distributorId;

    if (!distributorId) {
      throw new ValidationError('Distribyutor ID talab qilinadi');
    }

    if (!items || items.length === 0) {
      throw new ValidationError('Kamida bitta mahsulot bo\'lishi kerak');
    }

    // Buyurtmani yaratish
    const order = await prisma.order.create({
      data: {
        distributorId,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        status: OrderStatus.DRAFT,
        createdBy: user.id,
        updatedBy: user.id,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: 0,
            totalPrice: 0,
            createdBy: user.id,
            updatedBy: user.id,
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

    logger.info(`Order created: #${order.orderSeq} by ${user.name}`);

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
    const { orderDate, items } = req.body;
    const user = req.user!;

    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      throw new NotFoundError('Buyurtma topilmadi');
    }

    // Distribyutor faqat DRAFT holatdagi buyurtmani o'zgartira oladi
    if (user.role === 'DISTRIBUTOR') {
      if (existingOrder.distributorId !== user.id) {
        throw new AuthorizationError('Bu buyurtmani tahrirlashga ruxsatingiz yo\'q');
      }
      if (existingOrder.status !== 'DRAFT') {
        throw new ValidationError('Faqat DRAFT holatdagi buyurtmalarni tahrirlash mumkin');
      }
    }

    // Buyurtmani yangilash
    const order = await prisma.order.update({
      where: { id },
      data: {
        ...(orderDate && { orderDate: new Date(orderDate) }),
        updatedBy: user.id,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    logger.info(`Order updated: #${order.orderSeq} by ${user.name}`);

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

    if (!VALID_STATUSES.includes(status as OrderStatus)) {
      throw new ValidationError(
        `Noto'g'ri holat. Faqat ${VALID_STATUSES.join(', ')} holatlari mumkin`
      );
    }

    const order = await prisma.order.findUnique({
      where: { id },
    });

    if (!order) {
      throw new NotFoundError('Buyurtma topilmadi');
    }

    // Buyurtma holatini yangilash
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        status: status as OrderStatus,
        updatedBy: user.id,
      },
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
        status: status as OrderStatus,
        changedBy: user.id,
        notes: notes || `Holat ${status}ga o'zgartirildi`,
      },
    });

    logger.info(`Order status changed: #${order.orderSeq} to ${status} by ${user.name}`);

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

    logger.info(`Order deleted: #${order.orderSeq} by ${user.name}`);

    res.json({
      success: true,
      message: 'Buyurtma muvaffaqiyatli o\'chirildi',
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
