import { Request, Response, NextFunction } from 'express';
import { PrismaClient, User, NotificationType } from '@prisma/client';

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
  getUserNotifications, 
  markAsRead, 
  deleteNotification 
} from '../../controllers/notificationController';

const mockPrisma = new PrismaClient();

describe('Notification Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockUser: User;

  beforeEach(() => {
    mockUser = {
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
      user: mockUser,
    };

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('getUserNotifications', () => {
    it('should return all notifications for user', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          userId: 'user-123',
          type: 'ORDER_STATUS' as NotificationType,
          title: 'Buyurtma tasdiqlandi',
          message: 'Sizning buyurtmangiz tasdiqlandi',
          isRead: false,
          relatedEntityType: 'order',
          relatedEntityId: 'order-1',
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          userId: 'user-123',
          type: 'ORDER_CHANGE' as NotificationType,
          title: 'Buyurtma o\'zgartirildi',
          message: 'Mahsulot miqdori o\'zgartirildi',
          isRead: false,
          relatedEntityType: 'order',
          relatedEntityId: 'order-2',
          createdAt: new Date(),
        },
      ];

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(2);

      await getUserNotifications(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      expect(mockPrisma.notification.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          isRead: false,
        },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          notifications: mockNotifications,
          count: 2,
          unreadCount: 2,
        },
      });
    });

    it('should return empty array if no notifications', async () => {
      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(0);

      await getUserNotifications(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          notifications: [],
          count: 0,
          unreadCount: 0,
        },
      });
    });

    it('should count unread notifications correctly', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          userId: 'user-123',
          type: 'ORDER_STATUS' as NotificationType,
          title: 'Test',
          message: 'Test',
          isRead: false,
          relatedEntityType: null,
          relatedEntityId: null,
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          userId: 'user-123',
          type: 'ORDER_STATUS' as NotificationType,
          title: 'Test',
          message: 'Test',
          isRead: true,
          relatedEntityType: null,
          relatedEntityId: null,
          createdAt: new Date(),
        },
        {
          id: 'notif-3',
          userId: 'user-123',
          type: 'ORDER_STATUS' as NotificationType,
          title: 'Test',
          message: 'Test',
          isRead: false,
          relatedEntityType: null,
          relatedEntityId: null,
          createdAt: new Date(),
        },
      ];

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue(mockNotifications);
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(2);

      await getUserNotifications(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          notifications: mockNotifications,
          count: 3,
          unreadCount: 2,
        },
      });
    });

    it('should filter by isRead query parameter', async () => {
      mockRequest.query = { isRead: 'false' };

      (mockPrisma.notification.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.notification.count as jest.Mock).mockResolvedValue(0);

      await getUserNotifications(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
        where: { 
          userId: 'user-123',
          isRead: false,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      mockRequest.params = { id: 'notif-1' };

      const mockNotification = {
        id: 'notif-1',
        userId: 'user-123',
        type: 'ORDER_STATUS' as NotificationType,
        title: 'Test',
        message: 'Test',
        isRead: false,
        relatedEntityType: null,
        relatedEntityId: null,
        createdAt: new Date(),
      };

      const updatedNotification = {
        ...mockNotification,
        isRead: true,
      };

      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(mockNotification);
      (mockPrisma.notification.update as jest.Mock).mockResolvedValue(updatedNotification);

      await markAsRead(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });

      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { isRead: true },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { notification: updatedNotification },
        message: 'Xabarnoma o\'qilgan qilib belgilandi',
      });
    });

    it('should throw NotFoundError if notification not found', async () => {
      mockRequest.params = { id: 'non-existent' };

      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        markAsRead(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Xabarnoma topilmadi');
    });

    it('should throw ValidationError if notification belongs to another user', async () => {
      mockRequest.params = { id: 'notif-1' };

      const otherUserNotification = {
        id: 'notif-1',
        userId: 'other-user-456',
        type: 'ORDER_STATUS' as NotificationType,
        title: 'Test',
        message: 'Test',
        isRead: false,
        relatedEntityType: null,
        relatedEntityId: null,
        createdAt: new Date(),
      };

      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(otherUserNotification);

      await expect(
        markAsRead(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow();
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      mockRequest.params = { id: 'notif-1' };

      const mockNotification = {
        id: 'notif-1',
        userId: 'user-123',
        type: 'ORDER_STATUS' as NotificationType,
        title: 'Test',
        message: 'Test',
        isRead: false,
        relatedEntityType: null,
        relatedEntityId: null,
        createdAt: new Date(),
      };

      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(mockNotification);
      (mockPrisma.notification.delete as jest.Mock).mockResolvedValue(mockNotification);

      await deleteNotification(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockPrisma.notification.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });

      expect(mockPrisma.notification.delete).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Xabarnoma muvaffaqiyatli o\'chirildi',
      });
    });

    it('should throw NotFoundError if notification not found', async () => {
      mockRequest.params = { id: 'non-existent' };

      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        deleteNotification(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow('Xabarnoma topilmadi');
    });

    it('should throw ValidationError if notification belongs to another user', async () => {
      mockRequest.params = { id: 'notif-1' };

      const otherUserNotification = {
        id: 'notif-1',
        userId: 'other-user-456',
        type: 'ORDER_STATUS' as NotificationType,
        title: 'Test',
        message: 'Test',
        isRead: false,
        relatedEntityType: null,
        relatedEntityId: null,
        createdAt: new Date(),
      };

      (mockPrisma.notification.findUnique as jest.Mock).mockResolvedValue(otherUserNotification);

      await expect(
        deleteNotification(
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        )
      ).rejects.toThrow();
    });
  });
});