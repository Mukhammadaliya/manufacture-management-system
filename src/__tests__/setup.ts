/// <reference types="jest" />

// Test environmentni sozlash
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.DATABASE_URL = 'postgresql://postgres:postgres123@localhost:5432/manufacture_db_test';

// Global timeout
jest.setTimeout(10000);

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  // OrderStatus enum
  const OrderStatus = {
    DRAFT: 'DRAFT',
    SUBMITTED: 'SUBMITTED',
    CONFIRMED: 'CONFIRMED',
    IN_PRODUCTION: 'IN_PRODUCTION',
    READY: 'READY',
    DELIVERED: 'DELIVERED',
    CANCELLED: 'CANCELLED',
  };

  // UserRole enum
  const UserRole = {
    DISTRIBUTOR: 'DISTRIBUTOR',
    PRODUCER: 'PRODUCER',
    ADMIN: 'ADMIN',
  };

  // ProductUnit enum
  const ProductUnit = {
    KG: 'KG',
    PIECE: 'PIECE',
  };

  // NotificationType enum
  const NotificationType = {
    ORDER_STATUS: 'ORDER_STATUS',
    ORDER_CHANGE: 'ORDER_CHANGE',
    PRODUCTION_UPDATE: 'PRODUCTION_UPDATE',
    SYSTEM: 'SYSTEM',
  };

  // ProductionBatchStatus enum
  const ProductionBatchStatus = {
    PLANNED: 'PLANNED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
  };

  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    orderItem: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    orderStatusHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    productionBatch: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    productionBatchItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
  };

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
    OrderStatus,
    UserRole,
    ProductUnit,
    NotificationType,
    ProductionBatchStatus,
  };
});