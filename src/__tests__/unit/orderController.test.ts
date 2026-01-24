import { Request, Response, NextFunction } from 'express';
import { PrismaClient, User } from '@prisma/client';

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
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthorizationError';
    }
  },
}));

import { 
  getAllOrders, 
  getOrderById, 
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  updateOrderItem
} from '../../controllers/orderController';

// Mock Prisma
const mockPrisma = new PrismaClient();

describe('Order Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // User obyektini to'g'ri type bilan
    const mockUser: User = {
      id: 'user-123',
      telegramId: BigInt(123456789),
      role: 'DISTRIBUTOR',
      name: 'Test User',
      phone: '+998901234567',
      companyName: 'Test Company',
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

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('getAllOrders', () => {
    it('should return all orders for distributor', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          orderNumber: 'ORD-20260124-0001',
          distributorId: 'user-123',
          orderDate: new Date('2026-01-24'),
          deliveryDate: new Date('2026-01-25'),
          status: 'SUBMITTED',
          totalAmount: 1000,
          notes: 'Test order',
          createdAt: new Date(),
          updatedAt: new Date(),
          distributor: {
            id: 'user-123',
            name: 'Test User',
            companyName: 'Test Company',
            phone: '+998901234567',
          },
          items: [
            {
              id: 'item-1',
              orderId: 'order-1',
              productId: 'product-1',
              quantity: 10,
              originalQuantity: 10,
              adjustedQuantity: null,
              adjustmentReason: null,
              unitPrice: 50,
              totalPrice: 500,
              product: {
                id: 'product-1',
                name: 'Kolbasa',
                code: 'KOLB-001',
                unit: 'KG',
              },
            },
          ],
        },
      ];

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue(mockOrders);

      await getAllOrders(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: { distributorId: 'user-123' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          orders: mockOrders,
          count: 1,
        },
      });
    });

    it('should filter orders by status', async () => {
      mockRequest.query = { status: 'SUBMITTED' };

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);

      await getAllOrders(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: {
          distributorId: 'user-123',
          status: 'SUBMITTED',
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter orders by date range', async () => {
      mockRequest.query = {
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      };

      (mockPrisma.order.findMany as jest.Mock).mockResolvedValue([]);

      await getAllOrders(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        where: {
          distributorId: 'user-123',
          orderDate: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31'),
          },
        },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getOrderById', () => {
    it('should return order by id', async () => {
      mockRequest.params = { id: 'order-1' };

      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-20260124-0001',
        distributorId: 'user-123',
        orderDate: new Date('2026-01-24'),
        deliveryDate: new Date('2026-01-25'),
        status: 'SUBMITTED',
        totalAmount: 1000,
        notes: 'Test order',
        createdAt: new Date(),
        updatedAt: new Date(),
        distributor: {
          id: 'user-123',
          name: 'Test User',
          companyName: 'Test Company',
          phone: '+998901234567',
        },
        items: [],
        statusHistory: [],
      };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      await getOrderById(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: expect.any(Object),
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { order: mockOrder },
      });
    });

    it('should throw NotFoundError when order not found', async () => {
      mockRequest.params = { id: 'non-existent' };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      // Expect the function to throw
      await expect(
        getOrderById(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Buyurtma topilmadi');
    });
  });

  describe('createOrder', () => {
    it('should create new order for distributor', async () => {
      mockRequest.body = {
        orderDate: '2026-01-24',
        deliveryDate: '2026-01-25',
        items: [
          {
            productId: 'product-1',
            quantity: 10,
          },
        ],
        notes: 'Test order',
      };

      const mockCreatedOrder = {
        id: 'order-1',
        orderNumber: 'ORD-20260124-0001',
        distributorId: 'user-123',
        orderDate: new Date('2026-01-24'),
        deliveryDate: new Date('2026-01-25'),
        status: 'DRAFT',
        totalAmount: 0,
        notes: 'Test order',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'item-1',
            productId: 'product-1',
            quantity: 10,
            originalQuantity: 10,
            adjustedQuantity: null,
            adjustmentReason: null,
            unitPrice: 0,
            totalPrice: 0,
            product: {
              id: 'product-1',
              name: 'Kolbasa',
              code: 'KOLB-001',
              unit: 'KG',
            },
          },
        ],
      };

      (mockPrisma.order.create as jest.Mock).mockResolvedValue(mockCreatedOrder);
      (mockPrisma.orderStatusHistory.create as jest.Mock).mockResolvedValue({});

      await createOrder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.order.create).toHaveBeenCalled();
      expect(mockPrisma.orderStatusHistory.create).toHaveBeenCalled();

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { order: mockCreatedOrder },
        message: 'Buyurtma muvaffaqiyatli yaratildi',
      });
    });

    it('should throw ValidationError for empty items', async () => {
      mockRequest.body = {
        orderDate: '2026-01-24',
        deliveryDate: '2026-01-25',
        items: [],
      };

      // Expect the function to throw
      await expect(
        createOrder(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow("Kamida bitta mahsulot bo'lishi kerak");
    });
  });

  describe('updateOrder', () => {
    it('should update order successfully', async () => {
      const mockUser: User = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        role: 'DISTRIBUTOR',
        name: 'Test User',
        phone: '+998901234567',
        companyName: 'Test Company',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest = {
        params: { id: 'order-1' },
        body: {
          orderDate: '2026-01-25',
          deliveryDate: '2026-01-26',
          notes: 'Updated notes',
        },
        user: mockUser,
      };

      const existingOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        distributorId: 'user-123',
        status: 'DRAFT',
        orderDate: new Date('2026-01-24'),
        deliveryDate: new Date('2026-01-25'),
      };

      const updatedOrder = {
        ...existingOrder,
        orderDate: new Date('2026-01-25'),
        deliveryDate: new Date('2026-01-26'),
        notes: 'Updated notes',
        items: [],
      };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(existingOrder);
      (mockPrisma.order.update as jest.Mock).mockResolvedValue(updatedOrder);

      await updateOrder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.order.update).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { order: updatedOrder },
        message: 'Buyurtma muvaffaqiyatli yangilandi',
      });
    });

    it('should throw error if order not found', async () => {
      mockRequest.params = { id: 'non-existent' };
      mockRequest.body = { notes: 'test' };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        updateOrder(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Buyurtma topilmadi');
    });
  });

  describe('updateOrderStatus', () => {
    it('should update order status', async () => {
      mockRequest = {
        params: { id: 'order-1' },
        body: {
          status: 'CONFIRMED',
          notes: 'Tasdiqlandi',
        },
        user: mockRequest.user,
      };

      const existingOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        status: 'SUBMITTED',
      };

      const updatedOrder = {
        ...existingOrder,
        status: 'CONFIRMED',
        distributor: {
          id: 'user-123',
          name: 'Test User',
        },
        items: [],
      };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(existingOrder);
      (mockPrisma.order.update as jest.Mock).mockResolvedValue(updatedOrder);
      (mockPrisma.orderStatusHistory.create as jest.Mock).mockResolvedValue({});

      await updateOrderStatus(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.order.update).toHaveBeenCalled();
      expect(mockPrisma.orderStatusHistory.create).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { order: updatedOrder },
        message: 'Buyurtma holati muvaffaqiyatli o\'zgartirildi',
      });
    });
  });

  describe('deleteOrder', () => {
    it('should delete DRAFT order', async () => {
      mockRequest.params = { id: 'order-1' };

      const draftOrder = {
        id: 'order-1',
        orderNumber: 'ORD-001',
        distributorId: 'user-123',
        status: 'DRAFT',
      };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(draftOrder);
      (mockPrisma.order.delete as jest.Mock).mockResolvedValue(draftOrder);

      await deleteOrder(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.order.delete).toHaveBeenCalledWith({
        where: { id: 'order-1' },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Buyurtma muvaffaqiyatli o\'chirildi',
      });
    });

    it('should throw error if order not DRAFT', async () => {
      mockRequest.params = { id: 'order-1' };

      const submittedOrder = {
        id: 'order-1',
        status: 'SUBMITTED',
        distributorId: 'user-123',
      };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(submittedOrder);

      await expect(
        deleteOrder(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Faqat DRAFT holatdagi buyurtmalarni o\'chirish mumkin');
    });
  });

  describe('updateOrderItem', () => {
    it('should update order item quantity', async () => {
      mockRequest = {
        params: {
          orderId: 'order-1',
          itemId: 'item-1',
        },
        body: {
          adjustedQuantity: 8,
          adjustmentReason: 'Stock limit',
        },
        user: mockRequest.user,
      };

      const mockOrder = {
        id: 'order-1',
        distributorId: 'user-123',
        items: [
          {
            id: 'item-1',
            quantity: 10,
            productId: 'product-1',
          },
        ],
        distributor: {
          id: 'user-123',
          name: 'Test User',
          telegramId: BigInt(123456789),
        },
      };

      const updatedItem = {
        id: 'item-1',
        quantity: 10,
        adjustedQuantity: 8,
        adjustmentReason: 'Stock limit',
        product: {
          id: 'product-1',
          name: 'Kolbasa',
        },
      };

      (mockPrisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (mockPrisma.orderItem.update as jest.Mock).mockResolvedValue(updatedItem);
      (mockPrisma.notification.create as jest.Mock).mockResolvedValue({});

      await updateOrderItem(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.orderItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          adjustedQuantity: 8,
          adjustmentReason: 'Stock limit',
        },
        include: {
          product: true,
        },
      });

      expect(mockPrisma.notification.create).toHaveBeenCalled();

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { item: updatedItem },
        message: 'Buyurtma miqdori muvaffaqiyatli o\'zgartirildi',
      });
    });
  });
});