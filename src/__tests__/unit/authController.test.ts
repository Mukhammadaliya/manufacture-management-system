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
  AuthenticationError: class AuthenticationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'AuthenticationError';
    }
  },
}));

// Mock JWT utils
jest.mock('../../utils/jwt', () => ({
  generateToken: jest.fn(() => 'mock-jwt-token'),
  verifyToken: jest.fn(() => ({ userId: 'user-123' })),
}));

import { loginWithTelegram, getCurrentUser } from '../../controllers/authController';

const mockPrisma = new PrismaClient();

describe('Auth Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      user: undefined,
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('loginWithTelegram', () => {
    it('should login active user and return token', async () => {
      mockRequest.body = {
        telegramId: '123456789',
      };

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

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await loginWithTelegram(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: BigInt(123456789) },
        select: expect.any(Object),
      });

      // Real response - message yo'q, telegramId string
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.objectContaining({
            id: 'user-123',
            name: 'Test User',
            role: 'DISTRIBUTOR',
            phone: '+998901234567',
            companyName: 'Test Company',
          }),
          token: 'mock-jwt-token',
        },
      });

      // telegramId string sifatida qaytarilganini tekshirish
      const responseData = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(typeof responseData.data.user.telegramId).toBe('string');
      expect(responseData.data.user.telegramId).toBe('123456789');
    });

    it('should throw AuthenticationError if user not found', async () => {
      mockRequest.body = {
        telegramId: '999999999',
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        loginWithTelegram(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Foydalanuvchi topilmadi');
    });

    it('should throw AuthenticationError if user not active', async () => {
      mockRequest.body = {
        telegramId: '123456789',
      };

      const inactiveUser: User = {
        id: 'user-123',
        telegramId: BigInt(123456789),
        role: 'DISTRIBUTOR',
        name: 'Test User',
        phone: '+998901234567',
        companyName: 'Test Company',
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(inactiveUser);

      await expect(
        loginWithTelegram(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Foydalanuvchi faol emas');
    });

    it('should convert string telegramId to BigInt', async () => {
      mockRequest.body = {
        telegramId: '123456789',
      };

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

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await loginWithTelegram(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { telegramId: BigInt(123456789) },
        })
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user info', async () => {
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

      mockRequest.user = mockUser;

      await getCurrentUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // getCurrentUser faqat ba'zi fieldlarni qaytaradi
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { 
          user: expect.objectContaining({
            id: 'user-123',
            name: 'Test User',
            role: 'DISTRIBUTOR',
          })
        },
      });
    });

    it('should work with producer role', async () => {
      const mockProducer: User = {
        id: 'user-124',
        telegramId: BigInt(987654321),
        role: 'PRODUCER',
        name: 'Test Producer',
        phone: '+998901234568',
        companyName: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest.user = mockProducer;

      await getCurrentUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { 
          user: expect.objectContaining({
            id: 'user-124',
            name: 'Test Producer',
            role: 'PRODUCER',
          })
        },
      });
    });

    it('should work with admin role', async () => {
      const mockAdmin: User = {
        id: 'user-125',
        telegramId: BigInt(111111111),
        role: 'ADMIN',
        name: 'Admin User',
        phone: '+998901111111',
        companyName: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest.user = mockAdmin;

      await getCurrentUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { 
          user: expect.objectContaining({
            id: 'user-125',
            name: 'Admin User',
            role: 'ADMIN',
          })
        },
      });
    });

    it('should return user with telegramId as string', async () => {
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

      mockRequest.user = mockUser;

      await getCurrentUser(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseData = (mockResponse.json as jest.Mock).mock.calls[0][0];
      
      // telegramId string sifatida qaytariladi
      expect(typeof responseData.data.user.telegramId).toBe('string');
      expect(responseData.data.user.telegramId).toBe('123456789');
    });
  });
});