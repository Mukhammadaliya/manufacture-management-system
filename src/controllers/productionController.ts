import { Request, Response, NextFunction } from 'express';
import { PrismaClient, ProductionBatchStatus } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { NotFoundError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Batch nomer generatsiya qilish
const generateBatchNumber = (): string => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BATCH-${year}${month}${day}-${random}`;
};

// Barcha partiyalarni olish
export const getAllBatches = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { status, startDate, endDate } = req.query;

    const batches = await prisma.productionBatch.findMany({
      where: {
        ...(status && { status: status as ProductionBatchStatus }),
        ...(startDate && endDate && {
          productionDate: {
            gte: new Date(startDate as string),
            lte: new Date(endDate as string),
          },
        }),
      },
      include: {
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
        batches,
        count: batches.length,
      },
    });
  }
);

// Bitta partiyani olish
export const getBatchById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const batch = await prisma.productionBatch.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundError('Partiya topilmadi');
    }

    res.json({
      success: true,
      data: { batch },
    });
  }
);

// Yangi partiya yaratish
export const createBatch = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { productionDate, totalCapacity, items, notes } = req.body;
    const user = req.user!;

    if (!items || items.length === 0) {
      throw new ValidationError('Kamida bitta mahsulot bo\'lishi kerak');
    }

    const batchNumber = generateBatchNumber();

    // Umumiy hajmni hisoblash
    const usedCapacity = items.reduce(
      (sum: number, item: any) => sum + parseFloat(item.plannedQuantity),
      0
    );

    if (usedCapacity > totalCapacity) {
      throw new ValidationError(
        `Umumiy hajm (${usedCapacity}) qozon hajmidan (${totalCapacity}) oshib ketdi`
      );
    }

    const batch = await prisma.productionBatch.create({
      data: {
        batchNumber,
        productionDate: new Date(productionDate),
        totalCapacity,
        usedCapacity,
        notes,
        status: ProductionBatchStatus.PLANNED,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId,
            plannedQuantity: item.plannedQuantity,
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

    logger.info(`Production batch created: ${batch.batchNumber} by ${user.name}`);

    res.status(201).json({
      success: true,
      data: { batch },
      message: 'Ishlab chiqarish partiyasi muvaffaqiyatli yaratildi',
    });
  }
);

// Partiyani yangilash
export const updateBatch = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { status, notes, actualQuantities } = req.body;
    const user = req.user!;

    const existingBatch = await prisma.productionBatch.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingBatch) {
      throw new NotFoundError('Partiya topilmadi');
    }

    // Agar actual quantities berilgan bo'lsa, item'larni yangilash
    if (actualQuantities && Array.isArray(actualQuantities)) {
      for (const update of actualQuantities) {
        await prisma.productionBatchItem.update({
          where: { id: update.itemId },
          data: { actualQuantity: update.actualQuantity },
        });
      }
    }

    const batch = await prisma.productionBatch.update({
      where: { id },
      data: {
        ...(status && { status }),
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

    logger.info(`Production batch updated: ${batch.batchNumber} by ${user.name}`);

    res.json({
      success: true,
      data: { batch },
      message: 'Partiya muvaffaqiyatli yangilandi',
    });
  }
);

// Kunlik umumiy hisobot (Barcha buyurtmalar bo'yicha)
export const getDailySummary = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { date } = req.query;

    if (!date) {
      throw new ValidationError('Sana talab qilinadi');
    }

    const targetDate = new Date(date as string);

    // Barcha buyurtmalarni olish
    const orders = await prisma.order.findMany({
      where: {
        orderDate: {
          gte: new Date(targetDate.setHours(0, 0, 0, 0)),
          lte: new Date(targetDate.setHours(23, 59, 59, 999)),
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

    // Mahsulot bo'yicha umumiy miqdorni hisoblash
    const productSummary: { [key: string]: any } = {};

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const quantity = item.adjustedQuantity || item.quantity;
        const productKey = item.product.code;

        if (!productSummary[productKey]) {
          productSummary[productKey] = {
            productId: item.product.id,
            productName: item.product.name,
            productCode: item.product.code,
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

    res.json({
      success: true,
      data: {
        date: date,
        totalOrders: orders.length,
        summary,
      },
    });
  }
);