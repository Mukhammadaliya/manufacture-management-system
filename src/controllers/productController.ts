import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/errorHandler';
import { NotFoundError, ConflictError } from '../utils/errors';
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
    const { name, code, unit, baseRecipe, productionParameters } = req.body;

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
        unit,
        baseRecipe,
        productionParameters,
      },
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
    const { name, code, unit, baseRecipe, productionParameters, isActive } = req.body;

    // Mahsulot mavjudligini tekshirish
    const existingProduct = await prisma.product.findUnique({
      where: { id },
    });

    if (!existingProduct) {
      throw new NotFoundError('Mahsulot topilmadi');
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
        ...(unit && { unit }),
        ...(baseRecipe && { baseRecipe }),
        ...(productionParameters && { productionParameters }),
        ...(isActive !== undefined && { isActive }),
      },
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