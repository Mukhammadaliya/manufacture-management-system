import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Barcha mahsulotlarni olish
export const getAllProducts = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { isActive } = req.query;

    const products = await prisma.product.findMany({
      where: {
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      include: { measure: true },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: {
        products,
        count: products.length,
      },
    });
  }
);

// Bitta mahsulotni olish
export const getProductById = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: { measure: true },
    });

    if (!product) {
      throw new NotFoundError('Mahsulot topilmadi');
    }

    res.json({
      success: true,
      data: { product },
    });
  }
);

// Yangi mahsulot yaratish
export const createProduct = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, code, measureId, price } = req.body;
    const user = req.user!;

    // price validatsiyasi
    const parsedPrice = price !== undefined ? parseFloat(price) : 0;
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      throw new ValidationError('Narx 0 yoki undan katta bo\'lishi kerak');
    }

    // Kod mavjudligini tekshirish
    const existingProduct = await prisma.product.findUnique({
      where: { code },
    });

    if (existingProduct) {
      throw new ConflictError('Bu kodli mahsulot allaqachon mavjud');
    }

    const product = await prisma.product.create({
      data: {
        name,
        code,
        measureId,
        price: parsedPrice,
        createdBy: user.id,
        updatedBy: user.id,
      },
      include: { measure: true },
    });

    logger.info(`Product created: ${product.name} (${product.code})`);

    res.status(201).json({
      success: true,
      data: { product },
      message: 'Mahsulot muvaffaqiyatli yaratildi',
    });
  }
);

// Mahsulotni yangilash
export const updateProduct = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const { name, code, measureId, price, isActive } = req.body;
    const user = req.user!;

    // Mahsulot mavjudligini tekshirish
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundError('Mahsulot topilmadi');
    }

    // price validatsiyasi
    if (price !== undefined) {
      const parsedPrice = parseFloat(price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        throw new ValidationError('Narx 0 yoki undan katta bo\'lishi kerak');
      }
    }

    // Agar kod o'zgartirilyotgan bo'lsa, boshqa mahsulotda ishlatilmaganligini tekshirish
    if (code && code !== existingProduct.code) {
      const productWithCode = await prisma.product.findUnique({
        where: { code },
      });

      if (productWithCode) {
        throw new ConflictError('Bu kodli mahsulot allaqachon mavjud');
      }
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(measureId && { measureId }),
        ...(price !== undefined && { price: parseFloat(price) }),
        ...(isActive !== undefined && { isActive }),
        updatedBy: user.id,
      },
      include: { measure: true },
    });

    logger.info(`Product updated: ${product.name} (${product.code})`);

    res.json({
      success: true,
      data: { product },
      message: 'Mahsulot muvaffaqiyatli yangilandi',
    });
  }
);

// Mahsulotni o'chirish
export const deleteProduct = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundError('Mahsulot topilmadi');
    }

    await prisma.product.delete({
      where: { id },
    });

    logger.info(`Product deleted: ${product.name} (${product.code})`);

    res.json({
      success: true,
      message: 'Mahsulot muvaffaqiyatli o\'chirildi',
    });
  }
);