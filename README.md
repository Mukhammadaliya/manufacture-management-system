# 🥩 Real Taste of Meat - Manufacture Management System

Kolbasa va go'sht mahsulotlari ishlab chiqarish sexining buyurtmalarni boshqarish tizimi.

## 🎯 Loyiha Haqida

Bu tizim Real Taste of Meat kompaniyasi uchun buyurtmalarni qabul qilish, ishlab chiqarishni rejalashtirish va distributorlar bilan aloqani avtomatlashtirishga mo'ljallangan.

## ✨ Asosiy Funksiyalar

### Backend API
- ✅ Authentication & Authorization (JWT, RBAC)
- ✅ Products Management (CRUD)
- ✅ Orders Management (CRUD)
- ✅ Production Planning & Batches
- ✅ Notifications System
- ✅ Daily Summary Reports

### Telegram Bot
- ✅ **Distributor Interface**
  - Buyurtma yaratish
  - Buyurtmalarni ko'rish
  - Xabarnomalar
  - Profil
- ✅ **Producer/Admin Interface**
  - Barcha buyurtmalarni ko'rish
  - Kunlik hisobotlar
  - Filter va qidirish

## 🛠️ Technology Stack

- **Backend:** Node.js 18+ + TypeScript
- **Framework:** Express.js
- **Database:** PostgreSQL 15+
- **ORM:** Prisma 5.22.0
- **Bot:** Telegram Bot API (node-telegram-bot-api)
- **Authentication:** JWT (jsonwebtoken)
- **Validation:** Zod
- **Logging:** Winston
- **Testing:** Jest + Supertest + ts-jest

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Docker (opsional)

### Setup

1. Clone repository
```bash
git clone https://github.com/YOUR_USERNAME/manufacture-management-system.git
cd manufacture-management-system
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
cp .env.example .env
# Edit .env with your credentials
```

4. Start PostgreSQL (Docker)
```bash
docker run --name manufacture-postgres -e POSTGRES_PASSWORD=postgres123 -e POSTGRES_DB=manufacture_db -p 5432:5432 -d postgres:15
```

5. Run migrations
```bash
npx prisma migrate dev
```

6. Seed database
```bash
npm run seed
```

7. Start development server
```bash
npm run dev
```

## 🧪 Testing

### Run all tests
```bash
npm test
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run only unit tests
```bash
npm run test:unit
```

### Run only integration tests
```bash
npm run test:integration
```

**Test Statistics:**
- ✅ **66 tests** passing
- 📊 **Coverage:** 32.58% statements, 34.73% branches
- 📝 **Test suites:** 7 (unit: 6, integration: 1)
- 🎯 **Controllers:** 85%+ coverage

**Tested Modules:**
- ✅ orderController (13 tests) - 83.96%
- ✅ productController (10 tests) - 93.18%
- ✅ authController (8 tests) - 90.9%
- ✅ notificationController (10 tests) - 68%
- ✅ productionController (10 tests) - 93.93%
- ✅ jwtUtils (9 tests) - 100%
- ✅ integration tests (6 tests)

Batafsil ma'lumot uchun [TESTING.md](./TESTING.md) faylini ko'ring.

## 🚀 Deployment

Production build:
```bash
npm run build
npm start
```

## 📝 API Documentation

- Base URL: `http://localhost:3000/api`
- Authentication: Bearer JWT Token

### Endpoints
- `/api/auth` - Authentication
- `/api/products` - Products management
- `/api/orders` - Orders management
- `/api/production` - Production planning
- `/api/notifications` - Notifications

## 🤖 Telegram Bot

Bot Username: `@real_taste_meat_bot` (yoki sizning bot username'ingiz)

### Commands
- `/start` - Botni boshlash
- `/menu` - Asosiy menyu
- `/help` - Yordam

## 📊 Project Structure
```
manufacture-management-system/
├── src/
│   ├── __tests__/           # Test files
│   │   ├── setup.ts
│   │   ├── unit/
│   │   └── integration/
│   ├── bot/                 # Telegram bot
│   ├── controllers/         # Route controllers
│   ├── middleware/          # Express middleware
│   ├── routes/              # API routes
│   ├── utils/               # Utility functions
│   └── index.ts             # Entry point
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Seed data
├── jest.config.js           # Jest configuration
├── TESTING.md               # Testing documentation
└── package.json
```

## 👥 Roles

- **ADMIN** - Full access
- **PRODUCER** - Production management
- **DISTRIBUTOR** - Order placement

## 📄 License

Private - Real Taste of Meat Company

## 📞 Contact

For questions and support, contact the development team.

---

**Version:** 1.0.0  
**Status:** ✅ Production Ready (MVP)  
**Date:** 2026-01-24