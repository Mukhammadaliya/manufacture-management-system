# 🧪 Testing Guide

Bu hujjat loyihadagi testlar haqida ma'lumot beradi.

## 📦 Test kutubxonalari

- **Jest** - Test framework
- **ts-jest** - TypeScript support
- **Supertest** - HTTP testing
- **@types/jest** - TypeScript definitions

## 🚀 Testlarni ishga tushirish

### Barcha testlarni ishga tushirish
```bash
npm test
```

### Watch mode (o'zgarishlarni kuzatish)
```bash
npm run test:watch
```

### Coverage (qoplash darajasi) bilan
```bash
npm run test:coverage
```

### Faqat unit testlar
```bash
npm run test:unit
```

### Faqat integration testlar
```bash
npm run test:integration
```

## 📁 Test strukturasi
```
src/__tests__/
├── setup.ts                           # Test environment sozlamalari
├── unit/                              # Unit testlar
│   ├── authController.test.ts         # 8 tests
│   ├── orderController.test.ts        # 13 tests
│   ├── productController.test.ts      # 10 tests
│   ├── notificationController.test.ts # 10 tests
│   ├── productionController.test.ts   # 10 tests
│   └── jwtUtils.test.ts               # 9 tests
└── integration/                       # Integration testlar
    └── order.integration.test.ts      # 6 tests
```

## ✅ Mavjud testlar

### Unit Tests (60 tests)

#### Auth Controller (8 tests)
- ✅ Login with Telegram ID
- ✅ Get current user
- ✅ Handle authentication errors
- ✅ Validate inactive users
- ✅ Convert telegramId to BigInt
- ✅ Support multiple user roles

#### Order Controller (13 tests)
- ✅ Get all orders for distributor
- ✅ Filter orders by status
- ✅ Filter orders by date range
- ✅ Get order by ID
- ✅ Create new order
- ✅ Update order
- ✅ Update order status
- ✅ Delete DRAFT order
- ✅ Update order item quantity
- ✅ Handle validation errors

#### Product Controller (10 tests)
- ✅ Get all products
- ✅ Get product by ID
- ✅ Create new product
- ✅ Update product
- ✅ Delete product
- ✅ Handle duplicate product codes
- ✅ Validate product not found

#### Notification Controller (10 tests)
- ✅ Get user notifications
- ✅ Count unread notifications
- ✅ Mark notification as read
- ✅ Delete notification
- ✅ Filter by read status
- ✅ Validate user ownership

#### Production Controller (10 tests)
- ✅ Get daily summary
- ✅ Calculate product totals
- ✅ Handle adjusted quantities
- ✅ Get all production batches
- ✅ Get batch by ID
- ✅ Create production batch
- ✅ Update batch status
- ✅ Validate date requirement

#### JWT Utils (9 tests)
- ✅ Generate JWT token
- ✅ Verify JWT token
- ✅ Handle token expiration
- ✅ Handle invalid tokens
- ✅ Support multiple roles
- ✅ Include complete payload

### Integration Tests (6 tests)

#### Orders API (6 tests)
- ✅ GET /api/orders - List orders
- ✅ GET /api/orders?status=X - Filter by status
- ✅ GET /api/orders/:id - Get single order
- ✅ GET /api/orders/:id - Handle 404
- ✅ POST /api/orders - Create order
- ✅ POST /api/orders - Validation error

## 📊 Test Coverage

**Current Coverage:**
- **Statements:** 32.58%
- **Branches:** 34.73%
- **Functions:** 34.51%
- **Lines:** 33.11%

**Best Covered Modules:**
- `jwt.ts`: 100% ⭐
- `validators.ts`: 100% ⭐
- `orderRoutes.ts`: 100% ⭐
- `productionController.ts`: 93.93%
- `productController.ts`: 93.18%
- `authController.ts`: 90.9%
- `orderController.ts`: 83.96%

**Not Covered (Future Work):**
- `bot/handlers/*`: 0% (Telegram bot handlers)
- `middleware/auth.ts`: 0%
- `utils/logger.ts`: 0%
- `utils/notificationHelper.ts`: 0%

## 🔧 Yangi test qo'shish

### 1. Unit Test yaratish
```typescript
// src/__tests__/unit/myController.test.ts
import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

// Mock'lar
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockPrisma = new PrismaClient();

describe('My Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};
    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  it('should do something', async () => {
    // Test logic
    expect(true).toBe(true);
  });
});
```

### 2. Integration Test yaratish
```typescript
// src/__tests__/integration/myApi.integration.test.ts
import request from 'supertest';
import express from 'express';

describe('My API Integration Tests', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Routes qo'shish
  });

  it('should return data', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);

    expect(response.body).toBeDefined();
  });
});
```

## 🎯 Best Practices

1. **Mock'larni to'g'ri ishlating** - Real database'ga murojaat qilmang
2. **beforeEach'da tozalang** - Har bir test mustaqil bo'lishi kerak
3. **Bir test - bir narsa** - Har bir test bitta funksiyani tekshirsin
4. **Tushunarli nomlar** - Test nomi nima tekshirayotganini ko'rsatsin
5. **Error holatlarini test qiling** - Faqat success case'lar emas
6. **Coverage'ni kuzating** - Yangi kod yozganingizda test qo'shing

## 🐛 Debugging

Agar test ishlamasa:

1. Console.log qo'shing:
```typescript
console.log('Response:', response.body);
```

2. Jest verbose mode:
```bash
npm test -- --verbose
```

3. Bitta testni ishga tushirish:
```bash
npm test -- myController.test.ts
```

4. Specific test case:
```bash
npm test -- -t "should create order"
```

## 📚 Qo'shimcha resurslar

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [TypeScript Jest](https://kulshekhar.github.io/ts-jest/)

---

**Oxirgi yangilanish:** 2026-01-24  
**Test versiyasi:** 1.0.1  
**Status:** ✅ 66 tests passing  
**Coverage:** 32.58% statements