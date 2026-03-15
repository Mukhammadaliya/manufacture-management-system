# Full Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Loyihani to'liq qayta yozish — statuslarni soddalashtirish, bot UX yaxshilash, audit fieldlar qo'shish, Excel hisobot qo'shish.

**Architecture:** Prisma schema o'zgartiriladi (migration bilan), bot handlerlar qayta yoziladi, REST API controllerlar yangi schemaga moslashtiriladi.

**Tech Stack:** Node.js 18+, TypeScript, Express, Prisma 5, PostgreSQL, node-telegram-bot-api, exceljs (yangi)

**Design doc:** `docs/plans/2026-03-15-full-refactor-design.md`

---

## Task 1: Prisma Schema Yangilash

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Schema'ni yangilash**

`prisma/schema.prisma` faylini quyidagicha o'zgartiring:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  DISTRIBUTOR
  PRODUCER
  ADMIN
}

enum OrderStatus {
  DRAFT
  CONFIRMED
  DELIVERED
  CANCELLED
}

enum ProductUnit {
  KG
  PIECE
}

enum NotificationType {
  ORDER_STATUS
  ORDER_CHANGE
  SYSTEM
}

model User {
  id           String   @id @default(uuid())
  telegramId   BigInt   @unique @map("telegram_id")
  role         UserRole
  name         String
  phone        String?
  companyName  String?  @map("company_name")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  updatedBy    String   @default("SYSTEM") @map("updated_by")

  orders               Order[]
  notifications        Notification[]
  orderStatusChanges   OrderStatusHistory[]

  @@map("users")
}

model Product {
  id          String      @id @default(uuid())
  name        String
  code        String      @unique
  unit        ProductUnit
  price       Decimal     @default(0) @db.Decimal(10, 2)
  isActive    Boolean     @default(true) @map("is_active")
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")
  createdBy   String      @default("SYSTEM") @map("created_by")
  updatedBy   String      @default("SYSTEM") @map("updated_by")

  orderItems  OrderItem[]

  @@map("products")
}

model Order {
  id            String      @id @default(uuid())
  orderSeq      Int         @default(autoincrement()) @unique @map("order_seq")
  distributorId String      @map("distributor_id")
  orderDate     DateTime    @map("order_date") @db.Date
  status        OrderStatus @default(DRAFT)
  totalAmount   Decimal     @default(0) @map("total_amount") @db.Decimal(10, 2)
  createdAt     DateTime    @default(now()) @map("created_at")
  updatedAt     DateTime    @updatedAt @map("updated_at")
  createdBy     String      @map("created_by")
  updatedBy     String      @map("updated_by")

  distributor   User                 @relation(fields: [distributorId], references: [id])
  items         OrderItem[]
  statusHistory OrderStatusHistory[]

  @@map("orders")
}

model OrderItem {
  id        String   @id @default(uuid())
  orderId   String   @map("order_id")
  productId String   @map("product_id")
  quantity  Decimal  @db.Decimal(10, 2)
  unitPrice Decimal  @map("unit_price") @db.Decimal(10, 2)
  totalPrice Decimal @map("total_price") @db.Decimal(10, 2)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  createdBy String   @map("created_by")
  updatedBy String   @map("updated_by")

  order   Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])

  @@map("order_items")
}

model OrderStatusHistory {
  id        String   @id @default(uuid())
  orderId   String   @map("order_id")
  status    String
  changedBy String   @map("changed_by")
  notes     String?
  createdAt DateTime @default(now()) @map("created_at")

  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [changedBy], references: [id])

  @@map("order_status_history")
}

model Notification {
  id                String           @id @default(uuid())
  userId            String           @map("user_id")
  type              NotificationType
  title             String
  message           String
  isRead            Boolean          @default(false) @map("is_read")
  relatedEntityType String?          @map("related_entity_type")
  relatedEntityId   String?          @map("related_entity_id")
  createdAt         DateTime         @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("notifications")
}

model SystemSetting {
  id          String   @id @default(uuid())
  key         String   @unique
  value       Json
  description String?
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("system_settings")
}

model OrderTimeSetting {
  id                      String   @id @default(uuid())
  orderStartTime          String   @map("order_start_time")
  orderEndTime            String   @map("order_end_time")
  isActive                Boolean  @default(true) @map("is_active")
  notificationBeforeClose Int      @default(30) @map("notification_before_close")
  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")

  @@map("order_time_settings")
}
```

**Step 2: Migration yaratish**

```bash
npx prisma migrate dev --name full_refactor
```

Agar xatolik chiqsa (mavjud ma'lumotlar sababli), avval DB'ni tozalash:
```bash
npx prisma migrate reset
```

**Step 3: Prisma Client regeneratsiya**

```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: update schema - simplify statuses, add audit fields, add price"
```

---

## Task 2: Seed Faylni Yangilash

**Files:**
- Modify: `prisma/seed.ts`

**Step 1: Seed faylni to'liq qayta yozish**

`prisma/seed.ts` faylini yangi schemaga moslashtiring — asosiy o'zgarishlar:
- `deliveryDate` olib tashlash
- `originalQuantity`, `adjustedQuantity`, `adjustmentReason` olib tashlash
- `notes` olib tashlash
- Har bir mahsulotga `price` qo'shish (masalan: 45000.00)
- `createdBy`, `updatedBy` maydonlarini to'ldirish (admin.id ishlatish)
- `orderNumber` o'rniga `orderSeq` avtomatik
- `status` faqat: `DRAFT`, `CONFIRMED`, `DELIVERED`, `CANCELLED`
- `ProductionBatch` va `ProductionBatchItem` seedlarini olib tashlash

Mahsulot narxlari misoli:
```typescript
const products = [
  { code: 'KOLBASA-001', name: 'Doktorskaya kolbasa', unit: ProductUnit.KG, price: 45000 },
  { code: 'KOLBASA-002', name: 'Krakovskaya kolbasa', unit: ProductUnit.KG, price: 52000 },
  { code: 'SOSISKA-001', name: 'Mol go\'shtli sosiska', unit: ProductUnit.KG, price: 38000 },
  { code: 'SOSISKA-002', name: 'Tovuq sosiska', unit: ProductUnit.KG, price: 32000 },
  { code: 'VETCINA-001', name: 'Vetçina', unit: ProductUnit.KG, price: 58000 },
]
```

**Step 2: Seed ishga tushirish**

```bash
npm run seed
```

Expected: `✅ Seed muvaffaqiyatli yaratildi!`

**Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: update seed for new schema"
```

---

## Task 3: exceljs Paketini O'rnatish

**Step 1: O'rnatish**

```bash
npm install exceljs
npm install @types/exceljs --save-dev
```

**Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add exceljs for Excel reports"
```

---

## Task 4: Yordamchi Funksiyalar (helpers)

**Files:**
- Create: `src/bot/utils/orderHelpers.ts`

**Step 1: Yangi fayl yaratish**

`src/bot/utils/orderHelpers.ts`:

```typescript
// Status tarjimalari
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Kutilmoqda',
  CONFIRMED: 'Tasdiqlangan',
  DELIVERED: 'Yetkazilgan',
  CANCELLED: 'Bekor qilingan',
};

export const STATUS_EMOJI: Record<string, string> = {
  DRAFT: '⏳',
  CONFIRMED: '✅',
  DELIVERED: '📦',
  CANCELLED: '❌',
};

export function translateStatus(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function getStatusEmoji(status: string): string {
  return STATUS_EMOJI[status] || '📋';
}

// Sana formatlash: "15-mart 2026"
export function formatDate(date: Date): string {
  const months = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
  ];
  return `${date.getDate()}-${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Buyurtma raqami: #N
export function formatOrderNumber(seq: number): string {
  return `#${seq}`;
}

// Bugungi sana (UTC+5 Toshkent)
export function getTodayDate(): Date {
  const now = new Date();
  const tashkentOffset = 5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const tashkent = new Date(utc + tashkentOffset * 60000);
  return new Date(tashkent.getFullYear(), tashkent.getMonth(), tashkent.getDate());
}

// Sana tugmalari uchun
export function getDateOptions(): { label: string; date: Date }[] {
  const today = getTodayDate();
  return [
    { label: '📅 Bugun', date: today },
    { label: '📅 Ertaga', date: new Date(today.getTime() + 86400000) },
    { label: '📅 Indinga', date: new Date(today.getTime() + 86400000 * 2) },
  ];
}

// Narxni formatlash: "45 000 so'm"
export function formatPrice(price: number | string): string {
  const num = Number(price);
  return `${num.toLocaleString('uz-UZ')} so'm`;
}

// totalAmount hisoblash
export function calcTotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}
```

**Step 2: Commit**

```bash
git add src/bot/utils/orderHelpers.ts
git commit -m "feat: add order helper functions"
```

---

## Task 5: Distribyutor Order Handler Qayta Yozish

**Files:**
- Modify: `src/bot/handlers/orderHandler.ts`

**Step 1: Faylni to'liq qayta yozish**

Yangi oqim:
1. `startNewOrder` — mahsulotlar ro'yxati (inline buttons)
2. `selectProduct` — mahsulot tanlanadi, miqdor so'raladi
3. `enterQuantity` — miqdor kiritiladi, yana mahsulot qo'shish yoki tasdiqlash
4. `confirmOrder` — buyurtma yaratiladi (orderDate = bugun, status = DRAFT)
5. Barcha PRODUCER/ADMIN foydalanuvchilarga notification yuboriladi

```typescript
import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import logger from '../../utils/logger';
import { formatDate, formatOrderNumber, getTodayDate, formatPrice } from '../utils/orderHelpers';

const prisma = new PrismaClient();

interface OrderSession {
  userId: string;
  step: 'selecting_products' | 'entering_quantity';
  items: Array<{ productId: string; productName: string; unit: string; quantity: number; unitPrice: number }>;
}

const orderSessions = new Map<number, OrderSession>();

export const startNewOrder = async (bot: TelegramBot, chatId: number, userId: string) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    if (products.length === 0) {
      await bot.sendMessage(chatId, '❌ Hozirda mahsulotlar mavjud emas.');
      return;
    }

    orderSessions.set(chatId, { userId, step: 'selecting_products', items: [] });

    const keyboard = products.map((p) => [{
      text: `${p.name} — ${formatPrice(p.price)}`,
      callback_data: `select_product:${p.id}`,
    }]);
    keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

    await bot.sendMessage(chatId, '📦 Mahsulot tanlang:', {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('startNewOrder error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

export const selectProduct = async (
  bot: TelegramBot, chatId: number, messageId: number, productId: string
) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session) {
      await bot.sendMessage(chatId, '❌ Sessiya topilmadi. /start bosing.');
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    session.step = 'entering_quantity';
    session.items.push({
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      quantity: 0,
      unitPrice: Number(product.price),
    });
    orderSessions.set(chatId, session);

    await bot.editMessageText(
      `📦 ${product.name}\n💰 ${formatPrice(product.price)}\n\n🔢 Miqdorni kiriting (${product.unit}):`,
      {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]] },
      }
    );
  } catch (error) {
    logger.error('selectProduct error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

export const enterQuantity = async (bot: TelegramBot, chatId: number, quantity: number) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session || session.step !== 'entering_quantity') return;

    const lastItem = session.items[session.items.length - 1];
    lastItem.quantity = quantity;
    session.step = 'selecting_products';

    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    let summary = '📋 Tanlangan mahsulotlar:\n';
    session.items.forEach((item, i) => {
      summary += `${i + 1}. ${item.productName} — ${item.quantity} ${item.unit}\n`;
    });

    const remaining = products.filter((p) => !session.items.find((i) => i.productId === p.id));
    const keyboard: TelegramBot.InlineKeyboardButton[][] = remaining.map((p) => [{
      text: `${p.name} — ${formatPrice(p.price)}`,
      callback_data: `select_product:${p.id}`,
    }]);
    keyboard.push([{ text: '✅ Buyurtmani tasdiqlash', callback_data: 'confirm_order' }]);
    keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

    orderSessions.set(chatId, session);

    await bot.sendMessage(chatId, `${summary}\nQo'shish yoki tasdiqlash:`, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('enterQuantity error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};

export const confirmOrder = async (bot: TelegramBot, chatId: number) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session || session.items.length === 0) {
      await bot.sendMessage(chatId, '❌ Buyurtmada mahsulotlar yo\'q.');
      return;
    }

    const today = getTodayDate();
    const totalAmount = session.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice, 0
    );

    const order = await prisma.order.create({
      data: {
        distributorId: session.userId,
        orderDate: today,
        status: 'DRAFT',
        totalAmount,
        createdBy: session.userId,
        updatedBy: session.userId,
        items: {
          create: session.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
            createdBy: session.userId,
            updatedBy: session.userId,
          })),
        },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'DRAFT',
        changedBy: session.userId,
        notes: 'Buyurtma yaratildi',
      },
    });

    orderSessions.delete(chatId);

    let msg = `✅ Buyurtma yaratildi!\n\n`;
    msg += `🔢 ${formatOrderNumber(order.orderSeq)}\n`;
    msg += `📅 ${formatDate(order.orderDate)}\n`;
    msg += `⏳ Kutilmoqda\n\n`;
    msg += `📦 Mahsulotlar:\n`;
    order.items.forEach((item, i) => {
      msg += `${i + 1}. ${item.product.name} — ${item.quantity} ${item.product.unit}\n`;
    });
    msg += `\n💰 Jami: ${formatPrice(totalAmount)}`;

    await bot.sendMessage(chatId, msg, {
      reply_markup: {
        keyboard: [
          [{ text: '📦 Yangi buyurtma' }, { text: '📋 Buyurtmalarim' }],
          [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
        ],
        resize_keyboard: true,
      },
    });

    // Producerlarga notification yuborish
    await notifyProducers(bot, order);

    logger.info(`Order created: ${formatOrderNumber(order.orderSeq)} by ${session.userId}`);
  } catch (error) {
    logger.error('confirmOrder error:', error);
    await bot.sendMessage(chatId, '❌ Buyurtma yaratishda xatolik.');
  }
};

async function notifyProducers(bot: TelegramBot, order: any) {
  try {
    const producers = await prisma.user.findMany({
      where: {
        role: { in: ['PRODUCER', 'ADMIN'] },
        isActive: true,
      },
    });

    const distributor = await prisma.user.findUnique({
      where: { id: order.distributorId },
    });

    const name = distributor?.companyName || distributor?.name || 'Noma\'lum';
    const msg =
      `🆕 Yangi buyurtma ${formatOrderNumber(order.orderSeq)}\n\n` +
      `👤 ${name}\n` +
      `📅 ${formatDate(order.orderDate)}\n` +
      `📦 ${order.items.length} ta mahsulot\n` +
      `💰 ${formatPrice(order.totalAmount)}`;

    for (const producer of producers) {
      try {
        await bot.sendMessage(Number(producer.telegramId), msg, {
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Tasdiqlash', callback_data: `quick_confirm_${order.id}` },
              { text: '❌ Bekor qilish', callback_data: `quick_cancel_${order.id}` },
            ]],
          },
        });

        await prisma.notification.create({
          data: {
            userId: producer.id,
            type: 'SYSTEM',
            title: `Yangi buyurtma ${formatOrderNumber(order.orderSeq)}`,
            message: `${name} tomonidan yangi buyurtma berildi.`,
            relatedEntityType: 'order',
            relatedEntityId: order.id,
          },
        });
      } catch (e) {
        logger.warn(`Could not notify producer ${producer.id}:`, e);
      }
    }
  } catch (error) {
    logger.error('notifyProducers error:', error);
  }
}

export const cancelOrder = async (bot: TelegramBot, chatId: number) => {
  orderSessions.delete(chatId);
  await bot.sendMessage(chatId, '❌ Buyurtma bekor qilindi.', {
    reply_markup: {
      keyboard: [
        [{ text: '📦 Yangi buyurtma' }, { text: '📋 Buyurtmalarim' }],
        [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
      ],
      resize_keyboard: true,
    },
  });
};

export const getOrderSession = (chatId: number) => orderSessions.get(chatId);

export const viewMyOrders = async (bot: TelegramBot, chatId: number, userId: string) => {
  try {
    orderSessions.delete(chatId);

    const orders = await prisma.order.findMany({
      where: { distributorId: userId },
      orderBy: { orderSeq: 'desc' },
      take: 10,
    });

    if (orders.length === 0) {
      await bot.sendMessage(chatId, '📋 Hali buyurtmalar yo\'q.');
      return;
    }

    let msg = '📋 Buyurtmalarim:\n\n';
    orders.forEach((order, i) => {
      const emoji = order.status === 'DRAFT' ? '⏳'
        : order.status === 'CONFIRMED' ? '✅'
        : order.status === 'DELIVERED' ? '📦' : '❌';
      const label = order.status === 'DRAFT' ? 'Kutilmoqda'
        : order.status === 'CONFIRMED' ? 'Tasdiqlangan'
        : order.status === 'DELIVERED' ? 'Yetkazilgan' : 'Bekor qilingan';
      msg += `${i + 1}. ${formatOrderNumber(order.orderSeq)} — ${emoji} ${label}\n`;
      msg += `   📅 ${formatDate(order.orderDate)}\n\n`;
    });

    await bot.sendMessage(chatId, msg, {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]],
      },
    });
  } catch (error) {
    logger.error('viewMyOrders error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};
```

**Step 2: Commit**

```bash
git add src/bot/handlers/orderHandler.ts
git commit -m "feat: rewrite distributor order handler - simplified flow"
```

---

## Task 6: Producer Handler Qayta Yozish

**Files:**
- Modify: `src/bot/handlers/producerHandler.ts`

**Step 1: handleViewOrders funksiyasini yangilash**

Yangi filtrlar: bugun, kecha, ertaga, holat bo'yicha.

`handleViewOrders` funksiyasi endi `filter` parametri sifatida quyidagilarni qabul qiladi:
- `'today'` | `'yesterday'` | `'tomorrow'`
- `'DRAFT'` | `'CONFIRMED'` | `'DELIVERED'` | `'CANCELLED'`

```typescript
import { formatDate, formatOrderNumber, translateStatus, getStatusEmoji, getTodayDate } from '../utils/orderHelpers';

export async function handleViewOrders(
  bot: TelegramBot,
  chatId: number,
  filter: 'today' | 'yesterday' | 'tomorrow' | 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED'
) {
  try {
    const today = getTodayDate();
    let whereCondition: any = {};

    if (filter === 'today') {
      whereCondition = {
        orderDate: { gte: today, lt: new Date(today.getTime() + 86400000) },
        status: { not: 'CANCELLED' },
      };
    } else if (filter === 'yesterday') {
      const yesterday = new Date(today.getTime() - 86400000);
      whereCondition = {
        orderDate: { gte: yesterday, lt: today },
        status: { not: 'CANCELLED' },
      };
    } else if (filter === 'tomorrow') {
      const tomorrow = new Date(today.getTime() + 86400000);
      whereCondition = {
        orderDate: { gte: tomorrow, lt: new Date(today.getTime() + 86400000 * 2) },
        status: { not: 'CANCELLED' },
      };
    } else {
      whereCondition = { status: filter };
    }

    const orders = await prisma.order.findMany({
      where: whereCondition,
      include: {
        distributor: true,
        items: { include: { product: true } },
      },
      orderBy: { orderSeq: 'desc' },
      take: 20,
    });

    if (orders.length === 0) {
      await bot.sendMessage(chatId, '📋 Buyurtmalar topilmadi.', {
        reply_markup: { inline_keyboard: [[{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]] },
      });
      return;
    }

    let msg = `📊 Buyurtmalar (${orders.length} ta):\n\n`;
    orders.forEach((order, i) => {
      const name = order.distributor.companyName || order.distributor.name;
      msg += `${i + 1}. ${formatOrderNumber(order.orderSeq)} — ${getStatusEmoji(order.status)} ${translateStatus(order.status)}\n`;
      msg += `   👤 ${name} | 📅 ${formatDate(order.orderDate)}\n\n`;
    });

    const keyboard = orders.map((o) => [{
      text: `${formatOrderNumber(o.orderSeq)} — ${o.distributor.companyName || o.distributor.name}`,
      callback_data: `view_order_${o.id}`,
    }]);
    keyboard.push([{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }]);

    await bot.sendMessage(chatId, msg, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('handleViewOrders error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}
```

**Step 2: handleViewOrderDetail yangilash**

- `deliveryDate` ko'rsatmaslik
- `orderNumber` o'rniga `orderSeq` (#N)
- Faqat mumkin bo'lgan status tugmalarini ko'rsatish

```typescript
export async function handleViewOrderDetail(bot: TelegramBot, chatId: number, orderId: string) {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        distributor: true,
        items: { include: { product: true } },
      },
    });

    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    const name = order.distributor.companyName || order.distributor.name;
    let msg = `📋 ${formatOrderNumber(order.orderSeq)}\n`;
    msg += `👤 ${name}\n`;
    msg += `📅 ${formatDate(order.orderDate)}\n`;
    msg += `${getStatusEmoji(order.status)} ${translateStatus(order.status)}\n\n`;
    msg += `📦 Mahsulotlar:\n`;

    order.items.forEach((item, i) => {
      msg += `${i + 1}. ${item.product.name}\n`;
      msg += `   ${item.quantity} ${item.product.unit} × ${formatPrice(item.unitPrice)} = ${formatPrice(item.totalPrice)}\n`;
    });

    msg += `\n💰 Jami: ${formatPrice(order.totalAmount)}`;

    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];

    if (order.status === 'DRAFT') {
      keyboard.push([
        { text: '✅ Tasdiqlash', callback_data: `set_status_${orderId}_CONFIRMED` },
        { text: '❌ Bekor qilish', callback_data: `set_status_${orderId}_CANCELLED` },
      ]);
    } else if (order.status === 'CONFIRMED') {
      keyboard.push([
        { text: '📦 Yetkazildi', callback_data: `set_status_${orderId}_DELIVERED` },
        { text: '❌ Bekor qilish', callback_data: `set_status_${orderId}_CANCELLED` },
      ]);
    }

    if (order.status !== 'DELIVERED' && order.status !== 'CANCELLED') {
      keyboard.push([{ text: '✏️ Tahrirlash', callback_data: `edit_order_${orderId}` }]);
    }
    keyboard.push([{ text: '🔙 Orqaga', callback_data: 'view_orders_today' }]);

    await bot.sendMessage(chatId, msg, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('handleViewOrderDetail error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}
```

**Step 3: Edit menyusi qo'shish**

```typescript
export async function handleEditOrderMenu(bot: TelegramBot, chatId: number, orderId: string) {
  await bot.sendMessage(chatId, '✏️ Nima tahrirlaysiz?', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📅 Sana', callback_data: `edit_date_${orderId}` }],
        [{ text: '📦 Miqdorlar', callback_data: `edit_quantities_${orderId}` }],
        [{ text: '💰 Narxlar', callback_data: `edit_prices_${orderId}` }],
        [{ text: '🔙 Orqaga', callback_data: `view_order_${orderId}` }],
      ],
    },
  });
}
```

**Step 4: Sana tahrirlash**

```typescript
export async function handleEditDate(bot: TelegramBot, chatId: number, orderId: string) {
  const options = getDateOptions();
  const keyboard = options.map((opt) => [{
    text: opt.label,
    callback_data: `set_date_${orderId}_${opt.date.toISOString().split('T')[0]}`,
  }]);
  keyboard.push([{ text: '📅 Boshqa sana', callback_data: `set_date_custom_${orderId}` }]);
  keyboard.push([{ text: '🔙 Orqaga', callback_data: `edit_order_${orderId}` }]);

  await bot.sendMessage(chatId, '📅 Yangi sanani tanlang:', {
    reply_markup: { inline_keyboard: keyboard },
  });
}
```

**Step 5: Miqdor tahrirlash**

```typescript
export async function handleEditQuantities(bot: TelegramBot, chatId: number, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return;

  const keyboard = order.items.map((item) => [{
    text: `${item.product.name} — ${item.quantity} ${item.product.unit}`,
    callback_data: `edit_item_qty_${item.id}`,
  }]);
  keyboard.push([{ text: '🔙 Orqaga', callback_data: `edit_order_${orderId}` }]);

  await bot.sendMessage(chatId, '📦 Miqdorni o\'zgartirish uchun mahsulot tanlang:', {
    reply_markup: { inline_keyboard: keyboard },
  });
}
```

**Step 6: Narx tahrirlash**

```typescript
export async function handleEditPrices(bot: TelegramBot, chatId: number, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } } },
  });
  if (!order) return;

  const keyboard = order.items.map((item) => [{
    text: `${item.product.name} — ${formatPrice(item.unitPrice)}`,
    callback_data: `edit_item_price_${item.id}`,
  }]);
  keyboard.push([{ text: '🔙 Orqaga', callback_data: `edit_order_${orderId}` }]);

  await bot.sendMessage(chatId, '💰 Narxni o\'zgartirish uchun mahsulot tanlang:', {
    reply_markup: { inline_keyboard: keyboard },
  });
}
```

**Step 7: Commit**

```bash
git add src/bot/handlers/producerHandler.ts
git commit -m "feat: rewrite producer handler - new filters, edit functions"
```

---

## Task 7: Bot Index Yangilash (src/bot/index.ts)

**Files:**
- Modify: `src/bot/index.ts`

**Step 1: Callback handler'larni yangilash**

Quyidagi yangi callback'larni qo'shish:

```typescript
// Buyurtmalar filtri — yangi
if (data === 'view_orders_today') {
  await handleViewOrders(bot, chatId, 'today');
}
if (data === 'view_orders_yesterday') {
  await handleViewOrders(bot, chatId, 'yesterday');
}
if (data === 'view_orders_tomorrow') {
  await handleViewOrders(bot, chatId, 'tomorrow');
}
if (data === 'view_orders_DRAFT') {
  await handleViewOrders(bot, chatId, 'DRAFT');
}
if (data === 'view_orders_CONFIRMED') {
  await handleViewOrders(bot, chatId, 'CONFIRMED');
}
if (data === 'view_orders_DELIVERED') {
  await handleViewOrders(bot, chatId, 'DELIVERED');
}
if (data === 'view_orders_CANCELLED') {
  await handleViewOrders(bot, chatId, 'CANCELLED');
}

// Tahrirlash
if (data.startsWith('edit_order_')) {
  const orderId = data.replace('edit_order_', '');
  await handleEditOrderMenu(bot, chatId, orderId);
}
if (data.startsWith('edit_date_')) {
  const orderId = data.replace('edit_date_', '');
  await handleEditDate(bot, chatId, orderId);
}
if (data.startsWith('edit_quantities_')) {
  const orderId = data.replace('edit_quantities_', '');
  await handleEditQuantities(bot, chatId, orderId);
}
if (data.startsWith('edit_prices_')) {
  const orderId = data.replace('edit_prices_', '');
  await handleEditPrices(bot, chatId, orderId);
}

// Sana o'rnatish (Bugun/Ertaga/Indinga)
if (data.startsWith('set_date_') && !data.startsWith('set_date_custom_')) {
  // format: set_date_{orderId}_{YYYY-MM-DD}
  const parts = data.replace('set_date_', '').split('_');
  const dateStr = parts[parts.length - 1];
  const orderId = parts.slice(0, -1).join('_');
  await handleSetDate(bot, chatId, orderId, dateStr, user.id);
}
if (data.startsWith('set_date_custom_')) {
  const orderId = data.replace('set_date_custom_', '');
  customDateSessions[chatId] = { orderId };
  await bot.sendMessage(chatId, '📅 Sanani kiriting (YYYY-MM-DD):\nMasalan: 2026-03-20');
}

// Tez tasdiqlash/bekor qilish (producer notification'dan)
if (data.startsWith('quick_confirm_')) {
  const orderId = data.replace('quick_confirm_', '');
  await handleSetStatus(bot, chatId, orderId, 'CONFIRMED', user.id);
}
if (data.startsWith('quick_cancel_')) {
  const orderId = data.replace('quick_cancel_', '');
  await handleSetStatus(bot, chatId, orderId, 'CANCELLED', user.id);
}
```

**Step 2: showOrderFilters funksiyasini yangilash**

```typescript
async function showOrderFilters(bot: TelegramBot, chatId: number) {
  await bot.sendMessage(chatId, '📊 Buyurtmalar — filtr tanlang:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📅 Bugun', callback_data: 'view_orders_today' },
          { text: '📅 Kecha', callback_data: 'view_orders_yesterday' },
          { text: '📅 Ertaga', callback_data: 'view_orders_tomorrow' },
        ],
        [
          { text: '⏳ Kutilmoqda', callback_data: 'view_orders_DRAFT' },
          { text: '✅ Tasdiqlangan', callback_data: 'view_orders_CONFIRMED' },
        ],
        [
          { text: '📦 Yetkazilgan', callback_data: 'view_orders_DELIVERED' },
          { text: '❌ Bekor qilingan', callback_data: 'view_orders_CANCELLED' },
        ],
        [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
      ],
    },
  });
}
```

**Step 3: customDateSessions va message handler qo'shish**

```typescript
const customDateSessions: { [key: number]: { orderId: string } } = {};

// message handler ichida, reportDateSessions tekshirishidan keyin:
if (customDateSessions[chatId]) {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(text)) {
    await bot.sendMessage(chatId, '❌ Format: YYYY-MM-DD\nMasalan: 2026-03-20');
    return;
  }
  const { orderId } = customDateSessions[chatId];
  delete customDateSessions[chatId];
  await handleSetDate(bot, chatId, orderId, text, user.id);
  return;
}
```

**Step 4: item qty/price sessions qo'shish**

```typescript
// Sessions
const editItemQtySessions: { [key: number]: { itemId: string; orderId: string } } = {};
const editItemPriceSessions: { [key: number]: { itemId: string; orderId: string } } = {};

// Callback'larda:
if (data.startsWith('edit_item_qty_')) {
  const itemId = data.replace('edit_item_qty_', '');
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { product: true },
  });
  if (item) {
    editItemQtySessions[chatId] = { itemId, orderId: item.orderId };
    await bot.sendMessage(chatId,
      `📦 ${item.product.name}\nJoriy: ${item.quantity} ${item.product.unit}\n\nYangi miqdor kiriting:`
    );
  }
}

if (data.startsWith('edit_item_price_')) {
  const itemId = data.replace('edit_item_price_', '');
  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { product: true },
  });
  if (item) {
    editItemPriceSessions[chatId] = { itemId, orderId: item.orderId };
    await bot.sendMessage(chatId,
      `💰 ${item.product.name}\nJoriy narx: ${formatPrice(item.unitPrice)}\n\nYangi narx kiriting (so'm):`
    );
  }
}

// Message handler ichida:
if (editItemQtySessions[chatId]) {
  const qty = parseFloat(text);
  if (isNaN(qty) || qty <= 0) {
    await bot.sendMessage(chatId, '❌ To\'g\'ri raqam kiriting.');
    return;
  }
  const { itemId, orderId } = editItemQtySessions[chatId];
  delete editItemQtySessions[chatId];
  await handleUpdateItemQty(bot, chatId, itemId, orderId, qty, user.id);
  return;
}

if (editItemPriceSessions[chatId]) {
  const price = parseFloat(text);
  if (isNaN(price) || price < 0) {
    await bot.sendMessage(chatId, '❌ To\'g\'ri narx kiriting.');
    return;
  }
  const { itemId, orderId } = editItemPriceSessions[chatId];
  delete editItemPriceSessions[chatId];
  await handleUpdateItemPrice(bot, chatId, itemId, orderId, price, user.id);
  return;
}
```

**Step 5: Commit**

```bash
git add src/bot/index.ts
git commit -m "feat: update bot index - new callbacks and sessions"
```

---

## Task 8: Miqdor va Narx Yangilash Funksiyalari

**Files:**
- Modify: `src/bot/handlers/producerHandler.ts`

**Step 1: handleUpdateItemQty qo'shish**

```typescript
export async function handleUpdateItemQty(
  bot: TelegramBot, chatId: number,
  itemId: string, orderId: string,
  newQty: number, userId: string
) {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { product: true, order: true },
    });
    if (!item) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    const newTotal = newQty * Number(item.unitPrice);
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { quantity: newQty, totalPrice: newTotal, updatedBy: userId },
    });

    // Order totalAmount qayta hisoblash
    await recalcOrderTotal(orderId, userId);

    // Distribyutorga xabar
    await notifyDistributor(item.order.distributorId, orderId,
      `${formatOrderNumber(item.order.orderSeq)} buyurtmada ${item.product.name} miqdori ${newQty} ${item.product.unit} ga o'zgartirildi.`
    );

    await bot.sendMessage(chatId, `✅ Miqdor yangilandi: ${newQty} ${item.product.unit}`, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${orderId}` }]] },
    });
  } catch (error) {
    logger.error('handleUpdateItemQty error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

export async function handleUpdateItemPrice(
  bot: TelegramBot, chatId: number,
  itemId: string, orderId: string,
  newPrice: number, userId: string
) {
  try {
    const item = await prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { product: true, order: true },
    });
    if (!item) {
      await bot.sendMessage(chatId, '❌ Mahsulot topilmadi.');
      return;
    }

    const newTotal = Number(item.quantity) * newPrice;
    await prisma.orderItem.update({
      where: { id: itemId },
      data: { unitPrice: newPrice, totalPrice: newTotal, updatedBy: userId },
    });

    await recalcOrderTotal(orderId, userId);

    await notifyDistributor(item.order.distributorId, orderId,
      `${formatOrderNumber(item.order.orderSeq)} buyurtmada ${item.product.name} narxi ${formatPrice(newPrice)} ga o'zgartirildi.`
    );

    await bot.sendMessage(chatId, `✅ Narx yangilandi: ${formatPrice(newPrice)}`, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${orderId}` }]] },
    });
  } catch (error) {
    logger.error('handleUpdateItemPrice error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}

async function recalcOrderTotal(orderId: string, userId: string) {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  const total = items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
  await prisma.order.update({
    where: { id: orderId },
    data: { totalAmount: total, updatedBy: userId },
  });
}

async function notifyDistributor(distributorId: string, orderId: string, message: string) {
  await prisma.notification.create({
    data: {
      userId: distributorId,
      type: 'ORDER_CHANGE',
      title: 'Buyurtma o\'zgartirildi',
      message,
      relatedEntityType: 'order',
      relatedEntityId: orderId,
    },
  });
}
```

**Step 2: handleSetDate qo'shish**

```typescript
export async function handleSetDate(
  bot: TelegramBot, chatId: number,
  orderId: string, dateStr: string, userId: string
) {
  try {
    const newDate = new Date(dateStr);
    if (isNaN(newDate.getTime())) {
      await bot.sendMessage(chatId, '❌ Noto\'g\'ri sana. YYYY-MM-DD formatida kiriting.');
      return;
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      await bot.sendMessage(chatId, '❌ Buyurtma topilmadi.');
      return;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { orderDate: newDate, updatedBy: userId },
    });

    await notifyDistributor(order.distributorId, orderId,
      `${formatOrderNumber(order.orderSeq)} buyurtma sanasi ${formatDate(newDate)} ga o'zgartirildi.`
    );

    await bot.sendMessage(chatId, `✅ Sana yangilandi: ${formatDate(newDate)}`, {
      reply_markup: { inline_keyboard: [[{ text: '🔙 Buyurtmaga qaytish', callback_data: `view_order_${orderId}` }]] },
    });
  } catch (error) {
    logger.error('handleSetDate error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
}
```

**Step 3: handleSetStatus yangilash (distribyutorga notification)**

`handleSetStatus` ichida `notifyDistributor` chaqirish:

```typescript
await notifyDistributor(order.distributorId, orderId,
  `${formatOrderNumber(order.orderSeq)} buyurtma holati: ${translateStatus(oldStatus)} → ${translateStatus(newStatus)}`
);
```

**Step 4: Commit**

```bash
git add src/bot/handlers/producerHandler.ts
git commit -m "feat: add item qty/price update and date edit functions"
```

---

## Task 9: Excel Hisobot

**Files:**
- Create: `src/bot/utils/excelReport.ts`
- Modify: `src/bot/handlers/producerHandler.ts`

**Step 1: Excel generator yaratish**

`src/bot/utils/excelReport.ts`:

```typescript
import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

export interface ReportFilters {
  date?: Date;
  status?: string;
}

export async function generateOrdersExcel(filters: ReportFilters): Promise<string> {
  // Filtrlar
  const whereCondition: any = {};
  if (filters.date) {
    const d = filters.date;
    whereCondition.orderDate = {
      gte: d,
      lt: new Date(d.getTime() + 86400000),
    };
  }
  if (filters.status) {
    whereCondition.status = filters.status;
  }

  const orders = await prisma.order.findMany({
    where: whereCondition,
    include: {
      distributor: true,
      items: { include: { product: true } },
    },
    orderBy: { orderSeq: 'asc' },
  });

  // Barcha mahsulotlarni yig'ish
  const productMap = new Map<string, string>(); // id -> name
  orders.forEach((order) => {
    order.items.forEach((item) => {
      productMap.set(item.product.id, `${item.product.name} (${item.product.unit})`);
    });
  });

  const productIds = Array.from(productMap.keys());
  const productNames = Array.from(productMap.values());

  // Workbook yaratish
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Hisobot');

  // Header
  const headerRow = ['Mijoz', ...productNames, 'Jami (so\'m)'];
  sheet.addRow(headerRow);

  // Style header
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' },
  };

  // Column widths
  sheet.getColumn(1).width = 25;
  productIds.forEach((_, i) => { sheet.getColumn(i + 2).width = 18; });
  sheet.getColumn(productIds.length + 2).width = 15;

  // Ma'lumotlar
  const totals = new Array(productIds.length).fill(0);

  orders.forEach((order) => {
    const clientName = order.distributor.companyName || order.distributor.name;
    const row: any[] = [clientName];

    productIds.forEach((productId, i) => {
      const item = order.items.find((it) => it.productId === productId);
      const qty = item ? Number(item.quantity) : '';
      if (item) totals[i] += Number(item.quantity);
      row.push(qty);
    });

    row.push(Number(order.totalAmount));
    sheet.addRow(row);
  });

  // Jami qator
  const totalRow = ['JAMI', ...totals, orders.reduce((s, o) => s + Number(o.totalAmount), 0)];
  const lastRow = sheet.addRow(totalRow);
  lastRow.font = { bold: true };
  lastRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF0AA' },
  };

  // Faylni saqlash
  const tmpDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);
  const filePath = path.join(tmpDir, `report-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}
```

**Step 2: Hisobot menyusi va oqimi producerHandler'ga qo'shish**

```typescript
export async function handleReportMenu(bot: TelegramBot, chatId: number) {
  await bot.sendMessage(chatId, '📈 Hisobotlar:', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📅 Bugun', callback_data: 'report_today' },
          { text: '📅 Kecha', callback_data: 'report_yesterday' },
        ],
        [{ text: '📅 Boshqa sana', callback_data: 'report_custom_date' }],
        [{ text: '📊 Kengaytirilgan (Excel)', callback_data: 'report_excel_start' }],
        [{ text: '🔙 Orqaga', callback_data: 'back_to_menu' }],
      ],
    },
  });
}
```

**Step 3: Excel filtr oqimi uchun session**

`src/bot/index.ts` da:

```typescript
interface ExcelReportSession {
  step: 'asking_date' | 'asking_status' | 'date_input';
  date?: Date;
  status?: string;
}
const excelReportSessions: { [key: number]: ExcelReportSession } = {};

// Callback'da:
if (data === 'report_excel_start') {
  excelReportSessions[chatId] = { step: 'asking_date' };
  await bot.sendMessage(chatId, '📅 Sanani filterlaysizmi?', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Ha', callback_data: 'excel_filter_date_yes' },
          { text: '➡️ Yo\'q', callback_data: 'excel_filter_date_no' },
        ],
      ],
    },
  });
}
if (data === 'excel_filter_date_yes') {
  excelReportSessions[chatId] = { ...excelReportSessions[chatId], step: 'date_input' };
  await bot.sendMessage(chatId, '📅 Sanani kiriting (YYYY-MM-DD):');
}
if (data === 'excel_filter_date_no') {
  excelReportSessions[chatId] = { ...excelReportSessions[chatId], step: 'asking_status' };
  await askExcelStatus(bot, chatId);
}
if (data === 'excel_filter_status_no') {
  await generateAndSendExcel(bot, chatId, excelReportSessions[chatId]);
  delete excelReportSessions[chatId];
}
if (data.startsWith('excel_filter_status_')) {
  const status = data.replace('excel_filter_status_', '');
  if (['DRAFT','CONFIRMED','DELIVERED','CANCELLED'].includes(status)) {
    excelReportSessions[chatId].status = status;
    await generateAndSendExcel(bot, chatId, excelReportSessions[chatId]);
    delete excelReportSessions[chatId];
  }
}

// Message handler ichida:
if (excelReportSessions[chatId]?.step === 'date_input') {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(text)) {
    await bot.sendMessage(chatId, '❌ Format: YYYY-MM-DD');
    return;
  }
  excelReportSessions[chatId].date = new Date(text);
  excelReportSessions[chatId].step = 'asking_status';
  await askExcelStatus(bot, chatId);
  return;
}

// Helper funksiyalar:
async function askExcelStatus(bot: TelegramBot, chatId: number) {
  await bot.sendMessage(chatId, '📊 Holatni filterlaysizmi?', {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '⏳ Kutilmoqda', callback_data: 'excel_filter_status_DRAFT' },
          { text: '✅ Tasdiqlangan', callback_data: 'excel_filter_status_CONFIRMED' },
        ],
        [
          { text: '📦 Yetkazilgan', callback_data: 'excel_filter_status_DELIVERED' },
          { text: '❌ Bekor qilingan', callback_data: 'excel_filter_status_CANCELLED' },
        ],
        [{ text: '➡️ Filtrsiz', callback_data: 'excel_filter_status_no' }],
      ],
    },
  });
}

async function generateAndSendExcel(
  bot: TelegramBot, chatId: number, session: ExcelReportSession
) {
  await bot.sendMessage(chatId, '⏳ Hisobot tayyorlanmoqda...');
  const filePath = await generateOrdersExcel({ date: session.date, status: session.status });
  await bot.sendDocument(chatId, filePath, {}, { filename: 'hisobot.xlsx' });
  fs.unlinkSync(filePath); // Vaqtinchalik faylni o'chirish
}
```

**Step 4: Commit**

```bash
git add src/bot/utils/excelReport.ts src/bot/index.ts src/bot/handlers/producerHandler.ts
git commit -m "feat: add Excel report with optional filters"
```

---

## Task 10: REST API Controllerlarni Yangilash

**Files:**
- Modify: `src/controllers/orderController.ts`
- Modify: `src/controllers/productController.ts`
- Delete: `src/controllers/productionController.ts`
- Modify: `src/routes/productionRoutes.ts` → o'chirish yoki stub qoldirish

**Step 1: orderController.ts yangilash**

- `generateOrderNumber` funksiyasini o'chirish
- `deliveryDate`, `notes` qabul qilmaslik
- `orderDate = today` avtomatik o'rnatish
- `orderSeq` ni response'da ko'rsatish
- `status` faqat 4 ta qiymat: validation yangilash
- `createdBy`, `updatedBy` ni `req.user.id` dan olish

**Step 2: productController.ts yangilash**

- `price` maydonini `create` va `update` da qabul qilish
- Validation: `price >= 0`

**Step 3: productionController.ts o'chirish**

```bash
rm src/controllers/productionController.ts
# routes/productionRoutes.ts ichidan barcha routelarni olib tashlash
```

**Step 4: Commit**

```bash
git add src/controllers/ src/routes/
git commit -m "feat: update controllers for new schema"
```

---

## Task 11: Testlarni Yangilash

**Files:**
- Modify: `src/__tests__/unit/orderController.test.ts`
- Modify: `src/__tests__/unit/productController.test.ts`
- Delete: `src/__tests__/unit/productionController.test.ts`
- Modify: `src/__tests__/integration/order.integration.test.ts`

**Step 1: productionController test o'chirish**

```bash
rm src/__tests__/unit/productionController.test.ts
```

**Step 2: orderController test yangilash**

- `deliveryDate`, `notes` ishlatmaslik
- Yangi statuslarni test qilish (faqat 4 ta)
- `orderSeq` response'da tekshirish

**Step 3: productController test yangilash**

- `price` maydonini test qilish

**Step 4: Testlarni ishga tushirish**

```bash
npm test
```

Expected: barcha testlar o'tishi kerak

**Step 5: Commit**

```bash
git add src/__tests__/
git commit -m "test: update tests for new schema"
```

---

## Task 12: Tekshirish va Tozalash

**Step 1: TypeScript compile tekshirish**

```bash
npm run build
```

Expected: xatoliksiz compile

**Step 2: Bot ishga tushirish va to'liq test**

```bash
npm run dev
```

Test stsenariylar:
1. Distribyutor: yangi buyurtma yaratish (3 qadam)
2. Producer: notification kelishi, ✅ Tasdiqlash bosilishi
3. Producer: buyurtmalar filtrini sinash (bugun/kecha/ertaga/holat)
4. Producer: miqdor va narx tahrirlash
5. Producer: Excel hisobot (filtrlar bilan va filtrsiz)
6. Distribyutor: notification ko'rish

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete full refactor - simplified bot UX, audit fields, Excel reports"
```
