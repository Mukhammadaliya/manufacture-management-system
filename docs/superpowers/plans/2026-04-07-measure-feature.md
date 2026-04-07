# Measure (O'lchov birligi) Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `ProductUnit` enum with a `Measure` reference table and update all code to use `product.measure.shortName` instead of `product.unit`.

**Architecture:** New `Measure` model (id, name, shortName) with `Product.measureId` FK. Migration handles data transfer from old enum-based `unit` field. All bot messages, API responses, and Excel reports use `measure.shortName` (lowercase: "dona", "kg").

**Tech Stack:** Prisma ORM, PostgreSQL, TypeScript, node-telegram-bot-api, ExcelJS, Zod

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add Measure model, update Product, remove ProductUnit enum |
| Create | `prisma/migrations/<timestamp>_add_measure_table/migration.sql` | SQL migration with data transfer |
| Modify | `prisma/seed.ts` | Seed Measure records, update product seeds to use measureId |
| Modify | `src/utils/validators.ts` | Change `unit` to `measureId` in createProductSchema |
| Modify | `src/controllers/productController.ts` | Use `measureId`, include measure in queries |
| Modify | `src/bot/handlers/orderHandler.ts` | Use `product.measure.shortName` everywhere |
| Modify | `src/bot/handlers/producerHandler.ts` | Use `product.measure.shortName` everywhere |
| Modify | `src/bot/index.ts` | Use `product.measure.shortName` in quantity display |
| Modify | `src/bot/utils/excelReport.ts` | Use `product.measure.shortName` in column headers |
| Modify | `src/__tests__/setup.ts` | Remove ProductUnit mock, add measure mock support |
| Modify | `src/__tests__/unit/productController.test.ts` | Update mock products to use measureId/measure |
| Modify | `.github/workflows/deploy.yml` | Add `prisma migrate deploy` step |

---

### Task 1: Update Prisma Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Measure model and update Product model**

Replace the `ProductUnit` enum and update the `Product` model in `prisma/schema.prisma`:

Remove:
```prisma
enum ProductUnit {
  KG
  PIECE
}
```

Add (after the existing enums):
```prisma
model Measure {
  id        Int       @id @default(autoincrement())
  name      String
  shortName String    @map("short_name")
  createdAt DateTime  @default(now()) @map("created_at")

  products  Product[]

  @@map("measures")
}
```

In the `Product` model, replace:
```prisma
  unit        ProductUnit
```
with:
```prisma
  measureId   Int         @map("measure_id")
  measure     Measure     @relation(fields: [measureId], references: [id])
```

- [ ] **Step 2: Create migration SQL manually**

Run:
```bash
npx prisma migrate dev --create-only --name add_measure_table
```

Then replace the generated SQL content with this custom migration that handles data transfer:

```sql
-- 1. Create measures table
CREATE TABLE "measures" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "measures_pkey" PRIMARY KEY ("id")
);

-- 2. Seed measure data
INSERT INTO "measures" ("id", "name", "short_name") VALUES
(1, 'Dona', 'dona'),
(2, 'Kilogramm', 'kg');

-- 3. Add measureId column (nullable first)
ALTER TABLE "products" ADD COLUMN "measure_id" INTEGER;

-- 4. Set measureId based on product codes
-- DONA products (measureId = 1)
UPDATE "products" SET "measure_id" = 1 WHERE "code" IN (
  'BAZARSKI-05', 'BAZARSKI-06', 'BAZARSKI-NEW-05', 'BAZARSKI-NEW-06',
  'BAVARSKI-05', 'BAVARSKI-06', 'YANGI-TOSHKENT-06',
  'SER-AZ-03', 'SER-AZ-04', 'SER-AZ-05-ING', 'SER-AZ-05-QAL',
  'SER-AZ-06-ING', 'SER-AZ-06-QAL', 'SER-AZ-07-ING', 'SER-AZ-07-QAL',
  'SER-AZ-08', 'RAMAZON-08'
);

-- KG products (measureId = 2)
UPDATE "products" SET "measure_id" = 2 WHERE "code" IN (
  'DOKTOR', 'ZAFTRK', 'DOKTOR-ARZON', 'ZAFTRK-ARZON',
  'SASISKA', 'TIGR', 'SASISKA-ARZON', 'TIGR-ARZON',
  'TALLIN', 'JORJ', 'MAHKAMOV-BOMBA', 'ARQON-BOMBA',
  'MAHKAMOV-BREND', 'SERVELAT-BOMBA',
  'INDEYKA', 'YANGILIK-GOSHT', 'POKON', 'POKON-ARZON',
  'SALYAMI-05', 'SALYAMI-06', 'SETKA-03', 'SETKA-04',
  'BATON-BOMBA', 'GARADSKOY', 'CHIMKENT', 'ESTON', 'PRIMA'
);

-- Fallback: any remaining products default to dona
UPDATE "products" SET "measure_id" = 1 WHERE "measure_id" IS NULL;

-- 5. Make measureId NOT NULL and add FK
ALTER TABLE "products" ALTER COLUMN "measure_id" SET NOT NULL;
ALTER TABLE "products" ADD CONSTRAINT "products_measure_id_fkey" FOREIGN KEY ("measure_id") REFERENCES "measures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Drop old unit column and enum
ALTER TABLE "products" DROP COLUMN "unit";
DROP TYPE "ProductUnit";
```

- [ ] **Step 3: Apply migration locally**

Run:
```bash
npx prisma migrate dev
```

Expected: Migration applies successfully, Prisma client regenerated.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Measure reference table, replace ProductUnit enum"
```

---

### Task 2: Update Seed File

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: Update seed.ts**

In `prisma/seed.ts`:

1. Replace the import — change:
```typescript
import { PrismaClient, UserRole, ProductUnit, OrderStatus } from '@prisma/client';
```
to:
```typescript
import { PrismaClient, UserRole, OrderStatus } from '@prisma/client';
```

2. Add `Measure` cleanup and seeding after the existing cleanup block. After `await prisma.product.deleteMany({});` add:
```typescript
  await prisma.measure.deleteMany({});
  console.log('✅ Tozalandi');

  // 0. O'lchov birliklarini yaratish
  console.log('📏 O\'lchov birliklari yaratilmoqda...');

  await prisma.measure.upsert({
    where: { id: 1 },
    update: { name: 'Dona', shortName: 'dona' },
    create: { id: 1, name: 'Dona', shortName: 'dona' },
  });
  await prisma.measure.upsert({
    where: { id: 2 },
    update: { name: 'Kilogramm', shortName: 'kg' },
    create: { id: 2, name: 'Kilogramm', shortName: 'kg' },
  });

  console.log('✅ O\'lchov birliklari yaratildi');
```

3. Update `productData` array — replace `unit: ProductUnit.KG` with the correct `measureId` for each product:

```typescript
  const DONA = 1;
  const KG = 2;

  const productData = [
    // === BAZARSKI === (dona)
    { code: 'BAZARSKI-05', name: 'Bazarski 0.5', measureId: DONA, price: 0 },
    { code: 'BAZARSKI-06', name: 'Bazarski 0.6', measureId: DONA, price: 0 },
    { code: 'BAZARSKI-NEW-05', name: 'Bazarski New 0.5', measureId: DONA, price: 0 },
    { code: 'BAZARSKI-NEW-06', name: 'Bazarski New 0.6', measureId: DONA, price: 0 },

    // === BAVARSKI === (dona)
    { code: 'BAVARSKI-05', name: 'Bavarski 0.5', measureId: DONA, price: 0 },
    { code: 'BAVARSKI-06', name: 'Bavarski 0.6', measureId: DONA, price: 0 },

    // === YANGI TOSHKENT === (dona)
    { code: 'YANGI-TOSHKENT-06', name: 'Yangi toshkent 0.6', measureId: DONA, price: 0 },

    // === DOKTOR / ZAFTRK === (kg)
    { code: 'DOKTOR', name: 'Doktor', measureId: KG, price: 0 },
    { code: 'ZAFTRK', name: 'Zaftrk', measureId: KG, price: 0 },
    { code: 'DOKTOR-ARZON', name: 'Doktor arzon', measureId: KG, price: 0 },
    { code: 'ZAFTRK-ARZON', name: 'Zaftrk arzon', measureId: KG, price: 0 },

    // === SASISKA / TIGR === (kg)
    { code: 'SASISKA', name: 'Sasiska', measureId: KG, price: 0 },
    { code: 'TIGR', name: 'Tigr', measureId: KG, price: 0 },
    { code: 'SASISKA-ARZON', name: 'Sasiska arzon', measureId: KG, price: 0 },
    { code: 'TIGR-ARZON', name: 'Tigr arzon', measureId: KG, price: 0 },

    // === TALLIN / JORJ === (kg)
    { code: 'TALLIN', name: 'Tallin', measureId: KG, price: 0 },
    { code: 'JORJ', name: 'Jorj', measureId: KG, price: 0 },

    // === BOMBA / BREND === (kg)
    { code: 'MAHKAMOV-BOMBA', name: 'Mahkamov bomba', measureId: KG, price: 0 },
    { code: 'ARQON-BOMBA', name: 'Arqon bomba', measureId: KG, price: 0 },
    { code: 'MAHKAMOV-BREND', name: 'Mahkamov brend', measureId: KG, price: 0 },
    { code: 'SERVELAT-BOMBA', name: 'Servelat bomba', measureId: KG, price: 0 },

    // === SER AZ === (dona)
    { code: 'SER-AZ-03', name: 'Ser az 0.3', measureId: DONA, price: 0 },
    { code: 'SER-AZ-04', name: 'Ser az 0.4', measureId: DONA, price: 0 },
    { code: 'SER-AZ-05-ING', name: 'Ser az 0.5 ingichka', measureId: DONA, price: 0 },
    { code: 'SER-AZ-05-QAL', name: 'Ser az 0.5 qalin', measureId: DONA, price: 0 },
    { code: 'SER-AZ-06-ING', name: 'Ser az 0.6 ingichka', measureId: DONA, price: 0 },
    { code: 'SER-AZ-06-QAL', name: 'Ser az 0.6 qalin', measureId: DONA, price: 0 },
    { code: 'SER-AZ-07-ING', name: 'Ser az 0.7 ingichka', measureId: DONA, price: 0 },
    { code: 'SER-AZ-07-QAL', name: 'Ser az 0.7 qalin', measureId: DONA, price: 0 },
    { code: 'SER-AZ-08', name: 'Ser az 0.8', measureId: DONA, price: 0 },

    // === RAMAZON === (dona)
    { code: 'RAMAZON-08', name: 'Ramazon 0.8', measureId: DONA, price: 0 },

    // === BOSHQALAR === (kg)
    { code: 'INDEYKA', name: 'Indeyka', measureId: KG, price: 0 },
    { code: 'YANGILIK-GOSHT', name: 'Yangilik gosht', measureId: KG, price: 0 },
    { code: 'POKON', name: 'Pokon', measureId: KG, price: 0 },
    { code: 'POKON-ARZON', name: 'Pokon arzon', measureId: KG, price: 0 },

    // === SALYAMI === (kg)
    { code: 'SALYAMI-05', name: 'Salyami 0.5', measureId: KG, price: 0 },
    { code: 'SALYAMI-06', name: 'Salyami 0.6', measureId: KG, price: 0 },

    // === SETKA === (kg)
    { code: 'SETKA-03', name: 'Setka 0.3', measureId: KG, price: 0 },
    { code: 'SETKA-04', name: 'Setka 0.4', measureId: KG, price: 0 },

    // === QOLGAN MAHSULOTLAR === (kg)
    { code: 'BATON-BOMBA', name: 'Baton bomba', measureId: KG, price: 0 },
    { code: 'GARADSKOY', name: 'Garadskoy', measureId: KG, price: 0 },
    { code: 'CHIMKENT', name: 'Chimkent', measureId: KG, price: 0 },
    { code: 'ESTON', name: 'Eston', measureId: KG, price: 0 },
    { code: 'PRIMA', name: 'Prima', measureId: KG, price: 0 },
  ];
```

4. In the product upsert loop, change:
```typescript
      update: {
        name: p.name,
        unit: p.unit,
        updatedBy: admin.id,
      },
```
to:
```typescript
      update: {
        name: p.name,
        measureId: p.measureId,
        updatedBy: admin.id,
      },
```

- [ ] **Step 2: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: update seed with Measure references instead of ProductUnit"
```

---

### Task 3: Update Validators and Product Controller

**Files:**
- Modify: `src/utils/validators.ts`
- Modify: `src/controllers/productController.ts`

- [ ] **Step 1: Update validators.ts**

In `src/utils/validators.ts`, change the `createProductSchema`:

Replace:
```typescript
    unit: z.enum(['KG', 'PIECE']),
```
with:
```typescript
    measureId: z.number().int().positive('O\'lchov birligi tanlanishi kerak'),
```

- [ ] **Step 2: Update productController.ts**

In `src/controllers/productController.ts`:

**getAllProducts** (line 14) — add `include: { measure: true }`:
```typescript
    const products = await prisma.product.findMany({
      where: {
        ...(isActive !== undefined && { isActive: isActive === 'true' }),
      },
      include: { measure: true },
      orderBy: { name: 'asc' },
    });
```

**getProductById** (line 36) — add include:
```typescript
    const product = await prisma.product.findUnique({
      where: { id },
      include: { measure: true },
    });
```

**createProduct** (line 54) — change `unit` to `measureId`:
Replace:
```typescript
    const { name, code, unit, price } = req.body;
```
with:
```typescript
    const { name, code, measureId, price } = req.body;
```

In `prisma.product.create` data (line 72-80), replace:
```typescript
      data: {
        name,
        code,
        unit,
        price: parsedPrice,
        createdBy: user.id,
        updatedBy: user.id,
      },
```
with:
```typescript
      data: {
        name,
        code,
        measureId,
        price: parsedPrice,
        createdBy: user.id,
        updatedBy: user.id,
      },
```

Add `include: { measure: true }` to the create call.

**updateProduct** (line 97) — change `unit` to `measureId`:
Replace:
```typescript
    const { name, code, unit, price, isActive } = req.body;
```
with:
```typescript
    const { name, code, measureId, price, isActive } = req.body;
```

In the update data (line 128-138), replace:
```typescript
        ...(unit && { unit }),
```
with:
```typescript
        ...(measureId && { measureId }),
```

Add `include: { measure: true }` to the update call.

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/validators.ts src/controllers/productController.ts
git commit -m "feat: update validators and product controller for measureId"
```

---

### Task 4: Update Order Handler (Bot)

**Files:**
- Modify: `src/bot/handlers/orderHandler.ts`

- [ ] **Step 1: Update product queries to include measure**

In `showProductPage` (line 142), add `include`:
```typescript
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { measure: true },
    orderBy: { name: 'asc' },
  });
```

In `selectProduct` (line 237), add include:
```typescript
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { measure: true },
    });
```

In `enterQuantity` (line 282), add include:
```typescript
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: { measure: true },
      orderBy: { name: 'asc' },
    });
```

- [ ] **Step 2: Update unit references in selectProduct**

Line 247 — change:
```typescript
      unit: product.unit,
```
to:
```typescript
      unit: product.measure.shortName,
```

Line 254 — change:
```typescript
      `📦 ${product.name}\n💰 ${formatPrice(product.price)}\n\n🔢 Miqdorni kiriting (${product.unit}):`,
```
to:
```typescript
      `📦 ${product.name}\n💰 ${formatPrice(product.price)}\n\n🔢 Miqdorni kiriting (${product.measure.shortName}):`,
```

- [ ] **Step 3: Update confirmOrder product display**

Line 375 — change:
```typescript
      msg += `${i + 1}. ${item.product.name} — ${item.quantity} ${item.product.unit}\n`;
```
to:
```typescript
      msg += `${i + 1}. ${item.product.name} — ${item.quantity} ${item.product.measure.shortName}\n`;
```

Also update the `include` in the `prisma.order.create` call (line 353):
```typescript
      include: {
        items: { include: { product: { include: { measure: true } } } },
      },
```

- [ ] **Step 4: Commit**

```bash
git add src/bot/handlers/orderHandler.ts
git commit -m "feat: update order handler to use measure.shortName"
```

---

### Task 5: Update Producer Handler (Bot)

**Files:**
- Modify: `src/bot/handlers/producerHandler.ts`

- [ ] **Step 1: Update all product includes to nest measure**

Every `include: { product: true }` in producerHandler.ts must become `include: { product: { include: { measure: true } } }`.

Every `include: { product: true, order: { include: { distributor: true } } }` must become `include: { product: { include: { measure: true } }, order: { include: { distributor: true } } }`.

These are at lines: 103, 188, 250, 412, 454, 499, 557, 804, 949, 1001.

- [ ] **Step 2: Update all `.product.unit` display references**

Line 272 — change:
```typescript
      message += `   📊 Miqdor: ${item.quantity} ${item.product.unit}\n`;
```
to:
```typescript
      message += `   📊 Miqdor: ${item.quantity} ${item.product.measure.shortName}\n`;
```

Line 427 — change:
```typescript
        text: `${item.product.name} (${item.quantity} ${item.product.unit})`,
```
to:
```typescript
        text: `${item.product.name} (${item.quantity} ${item.product.measure.shortName})`,
```

Line 524 — change:
```typescript
      `${formatOrderNumber(item.order.orderSeq)} buyurtmadagi ${item.product.name} miqdori ${newQty} ${item.product.unit} ga o'zgartirildi.`
```
to:
```typescript
      `${formatOrderNumber(item.order.orderSeq)} buyurtmadagi ${item.product.name} miqdori ${newQty} ${item.product.measure.shortName} ga o'zgartirildi.`
```

Line 529 — change:
```typescript
      `✅ Miqdor yangilandi: ${item.product.name} — ${newQty} ${item.product.unit}`,
```
to:
```typescript
      `✅ Miqdor yangilandi: ${item.product.name} — ${newQty} ${item.product.measure.shortName}`,
```

Line 825 — change:
```typescript
            unit: item.product.unit,
```
to:
```typescript
            unit: item.product.measure.shortName,
```

Line 843 — this line uses `item.unit` from the productSummary object, no change needed (it already reads from the updated value above).

Line 918 — change:
```typescript
      `📊 Miqdor: ${item.quantity} ${item.product.unit}\n\n` +
```
to:
```typescript
      `📊 Miqdor: ${item.quantity} ${item.product.measure.shortName}\n\n` +
```

- [ ] **Step 3: Commit**

```bash
git add src/bot/handlers/producerHandler.ts
git commit -m "feat: update producer handler to use measure.shortName"
```

---

### Task 6: Update Bot Index (Main Bot File)

**Files:**
- Modify: `src/bot/index.ts`

- [ ] **Step 1: Update product includes in bot/index.ts**

All `include: { product: true }` queries that are used to display `.product.unit` must be updated to `include: { product: { include: { measure: true } } }`.

Lines with `product.unit` references: 397, 398, 452, 936, 983.

Update the include at line 385:
```typescript
        include: { product: { include: { measure: true } } },
```

Update the include at lines 419-422:
```typescript
        include: {
          product: { include: { measure: true } },
          order: { include: { distributor: true } },
        },
```

Update the include at line 931:
```typescript
        include: { product: { include: { measure: true } } },
```

Update the include at line 978 (change_item_ handler):
```typescript
        include: { product: { include: { measure: true } } },
```

- [ ] **Step 2: Update all `.product.unit` to `.product.measure.shortName`**

Line 397 — change:
```typescript
        `📊 Eski miqdor: ${item.quantity} ${item.product.unit}\n` +
```
to:
```typescript
        `📊 Eski miqdor: ${item.quantity} ${item.product.measure.shortName}\n` +
```

Line 398 — change:
```typescript
        `📊 Yangi miqdor: ${newQuantity} ${item.product.unit}\n\n` +
```
to:
```typescript
        `📊 Yangi miqdor: ${newQuantity} ${item.product.measure.shortName}\n\n` +
```

Line 452 — change:
```typescript
        `📊 Yangi miqdor: ${newQuantity} ${item.product.unit}\n` +
```
to:
```typescript
        `📊 Yangi miqdor: ${newQuantity} ${item.product.measure.shortName}\n` +
```

Line 936 — change:
```typescript
          `📦 ${item.product.name}\nJoriy: ${item.quantity} ${item.product.unit}\n\nYangi miqdor kiriting:`
```
to:
```typescript
          `📦 ${item.product.name}\nJoriy: ${item.quantity} ${item.product.measure.shortName}\n\nYangi miqdor kiriting:`
```

Line 983 — change:
```typescript
          `📦 ${item.product.name}\nJoriy: ${item.quantity} ${item.product.unit}\n\nYangi miqdor kiriting:`
```
to:
```typescript
          `📦 ${item.product.name}\nJoriy: ${item.quantity} ${item.product.measure.shortName}\n\nYangi miqdor kiriting:`
```

- [ ] **Step 3: Commit**

```bash
git add src/bot/index.ts
git commit -m "feat: update bot index to use measure.shortName"
```

---

### Task 7: Update Excel Report

**Files:**
- Modify: `src/bot/utils/excelReport.ts`

- [ ] **Step 1: Update product include in query**

Line 33 — change:
```typescript
      items: { include: { product: true } },
```
to:
```typescript
      items: { include: { product: { include: { measure: true } } } },
```

- [ ] **Step 2: Update column header display**

Line 49-51 — change:
```typescript
      productMap.set(
        item.product.id,
        `${item.product.name} (${item.product.unit})`
      );
```
to:
```typescript
      productMap.set(
        item.product.id,
        `${item.product.name} (${item.product.measure.shortName})`
      );
```

- [ ] **Step 3: Commit**

```bash
git add src/bot/utils/excelReport.ts
git commit -m "feat: update Excel report to use measure.shortName"
```

---

### Task 8: Update Tests

**Files:**
- Modify: `src/__tests__/setup.ts`
- Modify: `src/__tests__/unit/productController.test.ts`

- [ ] **Step 1: Update test setup mock**

In `src/__tests__/setup.ts`:

Remove the `ProductUnit` mock (lines 31-35):
```typescript
  // ProductUnit enum
  const ProductUnit = {
    KG: 'KG',
    PIECE: 'PIECE',
  };
```

Remove `ProductUnit` from the exports (line 113).

Add `measure` mock model to `mockPrismaClient`:
```typescript
    measure: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
```

- [ ] **Step 2: Update productController.test.ts**

In `src/__tests__/unit/productController.test.ts`:

Change import (line 2):
```typescript
import { PrismaClient, User } from '@prisma/client';
```

Replace all mock product objects. Everywhere you see `unit: 'KG' as ProductUnit`, replace with `measureId: 2, measure: { id: 2, name: 'Kilogramm', shortName: 'kg' }`.

For example, the `mockProducts` array (line 90-114) becomes:
```typescript
      const mockProducts = [
        {
          id: 'product-1',
          name: 'Mol go\'shti kolbasa',
          code: 'KOLB-001',
          measureId: 2,
          measure: { id: 2, name: 'Kilogramm', shortName: 'kg' },
          price: 50000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123',
          updatedBy: 'user-123',
        },
        {
          id: 'product-2',
          name: 'Tovuq kolbasa',
          code: 'KOLB-002',
          measureId: 2,
          measure: { id: 2, name: 'Kilogramm', shortName: 'kg' },
          price: 35000,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'user-123',
          updatedBy: 'user-123',
        },
      ];
```

Update `getAllProducts` assertion to check for `include: { measure: true }`:
```typescript
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        where: {},
        include: { measure: true },
        orderBy: { name: 'asc' },
      });
```

Update `getProductById` assertion:
```typescript
      expect(mockPrisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        include: { measure: true },
      });
```

Update `createProduct` test — change `mockRequest.body`:
```typescript
      mockRequest.body = {
        name: 'Yangi kolbasa',
        code: 'KOLB-003',
        measureId: 2,
        price: 45000,
      };
```

Update create assertion:
```typescript
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          name: 'Yangi kolbasa',
          code: 'KOLB-003',
          measureId: 2,
          price: 45000,
          createdBy: 'user-123',
          updatedBy: 'user-123',
        },
        include: { measure: true },
      });
```

Apply the same pattern to all other test cases that reference `unit`.

- [ ] **Step 3: Run tests**

Run:
```bash
npx jest --passWithNoTests
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/setup.ts src/__tests__/unit/productController.test.ts
git commit -m "feat: update tests for measure feature"
```

---

### Task 9: Update CI/CD Deploy Workflow

**Files:**
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add prisma migrate deploy to SSH script**

In `.github/workflows/deploy.yml`, update the "Extract and restart" step script:

Change:
```yaml
          script: |
            cd ~/app
            tar xzf node_modules.tar.gz
            rm node_modules.tar.gz
            git pull origin main
```
to:
```yaml
          script: |
            cd ~/app
            tar xzf node_modules.tar.gz
            rm node_modules.tar.gz
            git pull origin main
            cd ~/app && npx prisma migrate deploy
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: add prisma migrate deploy to CI/CD pipeline"
```

---

### Task 10: Build Verification and Final Commit

- [ ] **Step 1: Full TypeScript compilation check**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run all tests**

Run:
```bash
npx jest --passWithNoTests
```

Expected: All tests pass.

- [ ] **Step 3: Push to main**

```bash
git push origin main
```

Expected: Push succeeds, GitHub Actions deploys to AlwaysData with migration.
