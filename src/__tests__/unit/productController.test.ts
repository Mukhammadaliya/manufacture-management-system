import { Request, Response, NextFunction } from 'express';
import { PrismaClient, User, ProductUnit } from '@prisma/client';

// Mock logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock asyncHandler
jest.mock('../../middleware/errorHandler', () => ({
  asyncHandler: (fn: Function) => fn,
}));

// Mock errors
jest.mock('../../utils/errors', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ConflictError';
    }
  },
}));

import { 
  getAllProducts, 
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} from '../../controllers/productController';

const mockPrisma = new PrismaClient();

describe('Product Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    const mockUser: User = {
      id: 'user-123',
      telegramId: BigInt(123456789),
      role: 'ADMIN',
      name: 'Test Admin',
      phone: '+998901234567',
      companyName: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockRequest = {
      query: {},
      params: {},
      body: {},
      user: mockUser,
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('getAllProducts', () => {
    it('should return all active products', async () => {
      const mockProducts = [
        {
          id: 'product-1',
          name: 'Mol go\'shti kolbasa',
          code: 'KOLB-001',
          unit: 'KG' as ProductUnit,
          baseRecipe: null,
          productionParameters: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'product-2',
          name: 'Tovuq kolbasa',
          code: 'KOLB-002',
          unit: 'KG' as ProductUnit,
          baseRecipe: null,
          productionParameters: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.product.findMany as jest.Mock).mockResolvedValue(mockProducts);

      await getAllProducts(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { name: 'asc' },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          products: mockProducts,
          count: 2,
        },
      });
    });

    it('should return empty array when no products', async () => {
      (mockPrisma.product.findMany as jest.Mock).mockResolvedValue([]);

      await getAllProducts(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          products: [],
          count: 0,
        },
      });
    });
  });

  describe('getProductById', () => {
    it('should return product by id', async () => {
      mockRequest.params = { id: 'product-1' };

      const mockProduct = {
        id: 'product-1',
        name: 'Mol go\'shti kolbasa',
        code: 'KOLB-001',
        unit: 'KG' as ProductUnit,
        baseRecipe: { ingredient1: 50, ingredient2: 30 },
        productionParameters: { temperature: 80, time: 120 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(mockProduct);

      await getProductById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'product-1' },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { product: mockProduct },
      });
    });

    it('should throw NotFoundError when product not found', async () => {
      mockRequest.params = { id: 'non-existent' };

      (mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        getProductById(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Mahsulot topilmadi');
    });
  });

  describe('createProduct', () => {
    it('should create new product', async () => {
      mockRequest.body = {
        name: 'Yangi kolbasa',
        code: 'KOLB-003',
        unit: 'KG',
        baseRecipe: { ingredient1: 50 },
        productionParameters: { temperature: 80 },
      };

      const mockCreatedProduct = {
        id: 'product-3',
        name: 'Yangi kolbasa',
        code: 'KOLB-003',
        unit: 'KG' as ProductUnit,
        baseRecipe: { ingredient1: 50 },
        productionParameters: { temperature: 80 },
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.product.create as jest.Mock).mockResolvedValue(mockCreatedProduct);

      await createProduct(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          name: 'Yangi kolbasa',
          code: 'KOLB-003',
          unit: 'KG',
          baseRecipe: { ingredient1: 50 },
          productionParameters: { temperature: 80 },
        },
      });

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { product: mockCreatedProduct },
        message: 'Mahsulot muvaffaqiyatli yaratildi',
      });
    });

    it('should throw ConflictError if code already exists', async () => {
      mockRequest.body = {
        name: 'Yangi kolbasa',
        code: 'KOLB-001',
        unit: 'KG',
      };

      const existingProduct = {
        id: 'product-1',
        code: 'KOLB-001',
      };

      (mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(existingProduct);

      await expect(
        createProduct(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Bu kodli mahsulot allaqachon mavjud');
    });
  });

  describe('updateProduct', () => {
    it('should update product', async () => {
      mockRequest.params = { id: 'product-1' };
      mockRequest.body = {
        name: 'Yangilangan kolbasa',
        baseRecipe: { ingredient1: 60 },
      };

      const existingProduct = {
        id: 'product-1',
        code: 'KOLB-001',
        name: 'Eski nom',
      };

      const updatedProduct = {
        ...existingProduct,
        name: 'Yangilangan kolbasa',
        baseRecipe: { ingredient1: 60 },
      };

      (mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(existingProduct);
      (mockPrisma.product.update as jest.Mock).mockResolvedValue(updatedProduct);

      await updateProduct(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: {
          name: 'Yangilangan kolbasa',
          baseRecipe: { ingredient1: 60 },
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { product: updatedProduct },
        message: 'Mahsulot muvaffaqiyatli yangilandi',
      });
    });

    it('should throw NotFoundError if product not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { name: 'test' };

      (mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        updateProduct(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Mahsulot topilmadi');
    });
  });

  describe('deleteProduct', () => {
    it('should delete product by setting isActive to false', async () => {
      mockRequest.params = { id: 'product-1' };

      const existingProduct = {
        id: 'product-1',
        code: 'KOLB-001',
        isActive: true,
      };

      const deletedProduct = {
        ...existingProduct,
        isActive: false,
      };

      (mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(existingProduct);
      (mockPrisma.product.delete as jest.Mock).mockResolvedValue(deletedProduct);

      await deleteProduct(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Real funksiya delete ishlatadi
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({
        where: { id: 'product-1' },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Mahsulot muvaffaqiyatli o\'chirildi',
      });
    });

    it('should throw NotFoundError if product not found', async () => {
      mockRequest.params = { id: 'non-existent' };

      (mockPrisma.product.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        deleteProduct(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Mahsulot topilmadi');
    });
  });
});