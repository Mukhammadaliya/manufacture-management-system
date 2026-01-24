import { Request, Response, NextFunction } from 'express';
import { PrismaClient, User, ProductionBatchStatus } from '@prisma/client';

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
}));

import { 
  getDailySummary,
  getAllBatches,
  getBatchById,
  createBatch,
  updateBatch
} from '../../controllers/productionController';

const mockPrisma = new PrismaClient();

describe('Production Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockUser: User;

  beforeEach(() => {
    mockUser = {
      id: 'user-123',
      telegramId: BigInt(123456789),
      role: 'PRODUCER',
      name: 'Test Producer',
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

  describe('getDailySummary', () => {
    it('should return daily summary with orders', async () => {
      mockRequest.query = { date: '2026-01-24' };

      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          orderDate: new Date('2026-01-24'),
          deliveryDate: new Date('2026-01-25'),
          status: 'SUBMITTED',
          items: [
            {
              id: 'item-1',
              productId: 'product-1',
              quantity: 10,
              adjustedQuantity: null,
              product: {
                id: 'product-1',
                name: 'Mol kolbasa',
                code: 'KOLB-001',
                unit: 'KG',
              },
            },
            {
              id: 'item-2',
              productId: 'product-2',
              quantity: 20,
              adjustedQuantity: null,
              product: {
                id: 'product-2',
                name: 'Tovuq kolbasa',
                code: 'KOLB-002',
                unit: 'KG',
              },
            },
          ],
        },
        {
          id: 'order-2',
          orderNumber: 'ORD-002',
          orderDate: new Date('2026-01-24'),
          deliveryDate: new Date('2026-01-25'),
          status: 'CONFIRMED',
          items: [
            {
              id: 'item-3',
              productId: 'product-1',
              quantity: 15,
              adjustedQuantity: null,
              product: {
                id: 'product-1',
                name: 'Mol kolbasa',
                code: 'KOLB-001',
                unit: 'KG',
              },
            },
          ],
        },
      ];

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      await getDailySummary(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderDate: expect.any(Object),
            status: {
              notIn: ['CANCELLED'],
            },
          }),
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          date: '2026-01-24',
          totalOrders: 2,
          summary: expect.arrayContaining([
            expect.objectContaining({
              productCode: 'KOLB-001',
              productName: 'Mol kolbasa',
              totalQuantity: 25,
            }),
            expect.objectContaining({
              productCode: 'KOLB-002',
              productName: 'Tovuq kolbasa',
              totalQuantity: 20,
            }),
          ]),
        },
      });
    });

    it('should throw ValidationError if date not provided', async () => {
      mockRequest.query = {};

      await expect(
        getDailySummary(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Sana talab qilinadi');
    });

    it('should return empty summary if no orders', async () => {
      mockRequest.query = { date: '2026-01-24' };

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);

      await getDailySummary(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          date: '2026-01-24',
          totalOrders: 0,
          summary: [],
        },
      });
    });

    it('should use adjustedQuantity if available', async () => {
      mockRequest.query = { date: '2026-01-24' };

      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'ORD-001',
          orderDate: new Date('2026-01-24'),
          status: 'SUBMITTED',
          items: [
            {
              id: 'item-1',
              productId: 'product-1',
              quantity: 10,
              adjustedQuantity: 8,
              product: {
                id: 'product-1',
                name: 'Mol kolbasa',
                code: 'KOLB-001',
                unit: 'KG',
              },
            },
          ],
        },
      ];

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      await getDailySummary(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          date: '2026-01-24',
          totalOrders: 1,
          summary: [
            expect.objectContaining({
              totalQuantity: 8,
            }),
          ],
        },
      });
    });
  });

  describe('getAllBatches', () => {
    it('should return all production batches', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          batchNumber: 'BATCH-001',
          productionDate: new Date('2026-01-24'),
          status: 'IN_PROGRESS' as ProductionBatchStatus,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (mockPrisma.productionBatch.findMany as jest.Mock).mockResolvedValue(mockBatches);

      await getAllBatches(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.productionBatch.findMany).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          batches: mockBatches,
          count: 1,
        },
      });
    });
  });

  describe('getBatchById', () => {
    it('should return batch by id', async () => {
      mockRequest.params = { id: 'batch-1' };

      const mockBatch = {
        id: 'batch-1',
        batchNumber: 'BATCH-001',
        productionDate: new Date('2026-01-24'),
        status: 'IN_PROGRESS' as ProductionBatchStatus,
        items: [],
      };

      (mockPrisma.productionBatch.findUnique as jest.Mock).mockResolvedValue(mockBatch);

      await getBatchById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.productionBatch.findUnique).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { batch: mockBatch },
      });
    });

    it('should throw NotFoundError if batch not found', async () => {
      mockRequest.params = { id: 'non-existent' };

      (mockPrisma.productionBatch.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        getBatchById(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Partiya topilmadi');
    });
  });

  describe('createBatch', () => {
    it('should create new production batch', async () => {
      mockRequest.body = {
        productionDate: '2026-01-24',
        items: [
          {
            productId: 'product-1',
            plannedQuantity: 100,
          },
        ],
        notes: 'Test batch',
      };

      const mockCreatedBatch = {
        id: 'batch-1',
        batchNumber: 'BATCH-001',
        productionDate: new Date('2026-01-24'),
        status: 'PLANNED' as ProductionBatchStatus,
        notes: 'Test batch',
        items: [],
      };

      (mockPrisma.productionBatch.create as jest.Mock).mockResolvedValue(mockCreatedBatch);

      await createBatch(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.productionBatch.create).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { batch: mockCreatedBatch },
        message: 'Ishlab chiqarish partiyasi muvaffaqiyatli yaratildi', // To'g'ri message
      });
    });
  });

  describe('updateBatch', () => {
    it('should update production batch', async () => {
      mockRequest.params = { id: 'batch-1' };
      mockRequest.body = {
        status: 'COMPLETED',
        notes: 'Completed successfully',
      };

      const existingBatch = {
        id: 'batch-1',
        batchNumber: 'BATCH-001',
        status: 'IN_PROGRESS',
        items: [],
      };

      const updatedBatch = {
        ...existingBatch,
        status: 'COMPLETED' as ProductionBatchStatus,
        notes: 'Completed successfully',
        items: [],
      };

      (mockPrisma.productionBatch.findUnique as jest.Mock).mockResolvedValue(existingBatch);
      (mockPrisma.productionBatch.update as jest.Mock).mockResolvedValue(updatedBatch);

      await updateBatch(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.productionBatch.update).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { batch: updatedBatch },
        message: 'Partiya muvaffaqiyatli yangilandi',
      });
    });

    it('should throw NotFoundError if batch not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { status: 'COMPLETED' };

      (mockPrisma.productionBatch.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        updateBatch(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Partiya topilmadi');
    });
  });
});