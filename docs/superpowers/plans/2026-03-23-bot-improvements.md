# NMM Group Bot Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the /start bug, rebrand to NMM Group Bot, add product pagination, producer-on-behalf ordering, and CI/CD deploy workflow.

**Architecture:** Five independent changes to an existing Express + Telegram bot (node-telegram-bot-api) + Prisma + PostgreSQL app. Bug fix and branding are simple edits. Pagination and producer ordering extend the `orderHandler`. CI/CD adds a new GitHub Actions workflow.

**Tech Stack:** TypeScript, node-telegram-bot-api, Prisma, Winston, GitHub Actions, appleboy/ssh-action

**Spec:** `docs/superpowers/specs/2026-03-23-bot-improvements-design.md`

---

## File Structure

### Modified files

| File | Changes |
|------|---------|
| `src/utils/logger.ts` | Reduce maxsize to 2MB, maxFiles to 3, production level to `warn` |
| `src/index.ts` | Add global `unhandledRejection` / `uncaughtException` handlers |
| `src/bot/handlers/producerHandler.ts` | Fix `handleApproveUser` — add `parse_mode: 'Markdown'` to notification |
| `src/bot/index.ts` | Add debug logging to `/start`, branding update, pass `userRole` to `startNewOrder`, add `select_distributor` and pagination callbacks |
| `src/bot/handlers/orderHandler.ts` | Add `currentPage` and `forDistributorId` to `OrderSession`, pagination logic, distributor selection step |
| `src/bot/utils/messages.ts` | Rebrand "Real Taste of Meat" → "NMM Group Bot" |
| `README.md` | Rebrand |
| `DEPLOYMENT-ALWAYSDATA.md` | Rebrand |
| `package.json` | Rebrand description |

### New files

| File | Purpose |
|------|---------|
| `.github/workflows/deploy.yml` | CI/CD deploy on push to main |

---

## Task 1: Fix logger for free server disk protection

**Files:**
- Modify: `src/utils/logger.ts:1-46`

- [ ] **Step 1: Update logger config**

In `src/utils/logger.ts`, make these changes:

1. Change production level from `'info'` to `'warn'` (line 9):
```typescript
level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
```

2. Change error transport maxsize from 5242880 to 2097152 (2MB) and maxFiles from 5 to 3 (lines 22-23):
```typescript
maxsize: 2097152, // 2MB
maxFiles: 3,
```

3. Change combined transport maxsize and maxFiles same way (lines 28-29):
```typescript
maxsize: 2097152, // 2MB
maxFiles: 3,
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/logger.ts
git commit -m "fix: reduce log limits for free server disk protection"
```

---

## Task 2: Add global error handlers

**Files:**
- Modify: `src/index.ts:1-65`

- [ ] **Step 1: Add unhandled rejection and uncaught exception handlers**

Add at the top of `src/index.ts`, right after the imports (after line 13 `dotenv.config();`):

```typescript
// Global error handlers — prevents silent crashes
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
```

- [ ] **Step 2: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "fix: add global unhandledRejection and uncaughtException handlers"
```

---

## Task 3: Fix handleApproveUser notification and add /start diagnostics

**Files:**
- Modify: `src/bot/handlers/producerHandler.ts:1204-1214`
- Modify: `src/bot/index.ts:146-207`

- [ ] **Step 1: Add parse_mode to approval notification**

In `handleApproveUser` (around line 1204-1211), the `bot.sendMessage` to the approved user uses `**Tabriklaymiz!**` but doesn't specify `parse_mode`. Fix:

```typescript
      await bot.sendMessage(
        Number(user.telegramId),
        `✅ *Tabriklaymiz!*\n\n` +
          `Sizning arizangiz tasdiqlandi.\n` +
          `Endi botdan to\'liq foydalanishingiz mumkin.\n\n` +
          `Asosiy menyuni ochish uchun /start buyrug\'ini yuboring.`,
        { parse_mode: 'Markdown' }
      );
```

Note: Changed `**Tabriklaymiz!**` to `*Tabriklaymiz!*` — Telegram Markdown uses single `*` for bold (not double `**`).

- [ ] **Step 2: Add debug logging to /start handler**

In `src/bot/index.ts`, inside the `/start` handler (lines 146-207), add debug logs:

After `const user = await findUser(msg.from.id);` (line 152):
```typescript
    logger.debug(`/start: findUser(${msg.from.id}) = ${user ? `id=${user.id}, isActive=${user.isActive}, role=${user.role}` : 'null'}`);
```

After `await bot.sendMessage(chatId, welcomeMessage, {` completes (after line 200):
```typescript
    logger.debug(`/start: welcome message sent to ${chatId}`);
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/bot/handlers/producerHandler.ts src/bot/index.ts
git commit -m "fix: add parse_mode to approval notification and debug logging to /start"
```

---

## Task 4: Rebrand "Real Taste of Meat" → "NMM Group Bot"

**Files:**
- Modify: `src/bot/index.ts:160,192`
- Modify: `src/bot/utils/messages.ts:6`
- Modify: `README.md:1,7`
- Modify: `DEPLOYMENT-ALWAYSDATA.md` (all occurrences)
- Modify: `package.json` (description, if set)

- [ ] **Step 1: Find all occurrences**

Run: `grep -r "Real Taste of Meat" --include="*.ts" --include="*.md" --include="*.json" .`

This will show every file needing change. Process each one.

- [ ] **Step 2: Update bot/index.ts**

Line ~160 (registration welcome):
```typescript
      const message =
        `Assalomu alaykum! 👋\n\n` +
        `🥩 NMM Group Bot - Buyurtmalar botiga xush kelibsiz!\n\n` +
        `Iltimos, rolni tanlang:`;
```

Line ~192 (user welcome):
```typescript
    const welcomeMessage =
      `Assalomu alaykum, ${user.name}! 👋\n\n` +
      `🥩 NMM Group Bot - Buyurtmalar botiga xush kelibsiz!\n\n` +
      `Bu bot orqali siz:\n` +
      `✅ Buyurtma berishingiz\n` +
      `✅ Buyurtmalaringizni kuzatishingiz\n` +
      `✅ Xabarnomalar olishingiz mumkin`;
```

- [ ] **Step 3: Update bot/utils/messages.ts**

Line 6:
```typescript
🥩 NMM Group Bot - Buyurtmalar botiga xush kelibsiz!
```

- [ ] **Step 4: Update README.md**

Line 1:
```markdown
# 🥩 NMM Group Bot - Manufacture Management System
```

Line 7:
```markdown
Bu tizim NMM Group Bot kompaniyasi uchun buyurtmalarni qabul qilish...
```

- [ ] **Step 5: Update DEPLOYMENT-ALWAYSDATA.md**

Replace all "Real Taste of Meat" with "NMM Group Bot".

- [ ] **Step 6: Verify no remaining occurrences**

Run: `grep -r "Real Taste of Meat" --include="*.ts" --include="*.md" --include="*.json" .`
Expected: No results

- [ ] **Step 7: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/bot/index.ts src/bot/utils/messages.ts README.md DEPLOYMENT-ALWAYSDATA.md package.json
git commit -m "chore: rebrand Real Taste of Meat to NMM Group Bot"
```

Note: Only add explicitly listed files. If `grep` found additional files, add them too.

---

## Task 5: Add pagination to product selection

**Files:**
- Modify: `src/bot/handlers/orderHandler.ts:35-175`
- Modify: `src/bot/index.ts:740-744` (callback handler)

- [ ] **Step 1: Update OrderSession interface**

In `src/bot/handlers/orderHandler.ts`, update the `OrderSession` interface (lines 35-45):

```typescript
interface OrderSession {
  userId: string;
  step: 'selecting_products' | 'entering_quantity';
  items: Array<{
    productId: string;
    productName: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  }>;
  currentPage: number;
  forDistributorId?: string;
  lastMessageId?: number;
}
```

- [ ] **Step 2: Add pagination helper function**

Add a new helper function after the `OrderSession` interface, before `startNewOrder`:

```typescript
const PRODUCTS_PER_PAGE = 8;

function buildProductPageKeyboard(
  products: Array<{ id: string; name: string; price: any }>,
  selectedProductIds: string[],
  page: number,
  hasItems: boolean
): { keyboard: TelegramBot.InlineKeyboardButton[][]; totalPages: number; text: string } {
  const remaining = products.filter((p) => !selectedProductIds.includes(p.id));
  const totalPages = Math.max(1, Math.ceil(remaining.length / PRODUCTS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PRODUCTS_PER_PAGE;
  const pageProducts = remaining.slice(start, start + PRODUCTS_PER_PAGE);

  const keyboard: TelegramBot.InlineKeyboardButton[][] = pageProducts.map((p) => [
    {
      text: `${p.name} — ${formatPrice(p.price)}`,
      callback_data: `select_product:${p.id}`,
    },
  ]);

  // Navigation row
  const navRow: TelegramBot.InlineKeyboardButton[] = [];
  if (safePage > 0) {
    navRow.push({ text: '⬅️', callback_data: 'order_page_prev' });
  }
  navRow.push({ text: `📄 ${safePage + 1}/${totalPages}`, callback_data: 'order_page_noop' });
  if (safePage < totalPages - 1) {
    navRow.push({ text: '➡️', callback_data: 'order_page_next' });
  }
  if (totalPages > 1) {
    keyboard.push(navRow);
  }

  // Action buttons
  if (hasItems) {
    keyboard.push([{ text: '✅ Buyurtmani tasdiqlash', callback_data: 'confirm_order' }]);
  }
  keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

  const text = remaining.length > 0
    ? `📦 Mahsulot tanlang (${safePage + 1}/${totalPages}):`
    : '📦 Barcha mahsulotlar tanlandi.';

  return { keyboard, totalPages, text };
}
```

- [ ] **Step 3: Update startNewOrder to use pagination**

Replace the body of `startNewOrder` (lines 49-84):

```typescript
export const startNewOrder = async (bot: TelegramBot, chatId: number, userId: string, userRole?: string) => {
  try {
    if (await isOrderBanned()) {
      await bot.sendMessage(chatId, '🚫 Hozirda buyurtma berish to\'xtatilgan. Iltimos, keyinroq urinib ko\'ring.');
      return;
    }

    // Producer/Admin: first select distributor
    if (userRole === 'PRODUCER' || userRole === 'ADMIN') {
      const distributors = await prisma.user.findMany({
        where: { role: 'DISTRIBUTOR', isActive: true },
        orderBy: { name: 'asc' },
      });

      if (distributors.length === 0) {
        await bot.sendMessage(chatId, '❌ Faol distribyutorlar topilmadi.');
        return;
      }

      const keyboard: TelegramBot.InlineKeyboardButton[][] = distributors.map((d) => [
        {
          text: `${d.name}${d.companyName ? ' — "' + d.companyName + '"' : ''}`,
          callback_data: `select_distributor:${d.id}`,
        },
      ]);
      keyboard.push([{ text: '❌ Bekor qilish', callback_data: 'cancel_order' }]);

      await bot.sendMessage(chatId, '👥 Qaysi distribyutor uchun buyurtma yaratmoqchisiz?', {
        reply_markup: { inline_keyboard: keyboard },
      });
      // No session created yet — session will be created in selectDistributor → showProductPage
      return;
    }

    // Distributor: go directly to product selection
    await showProductPage(bot, chatId, userId);
  } catch (error) {
    logger.error('startNewOrder error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};
```

- [ ] **Step 4: Add showProductPage helper**

Add after `startNewOrder`:

```typescript
async function showProductPage(bot: TelegramBot, chatId: number, userId: string, forDistributorId?: string) {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  if (products.length === 0) {
    await bot.sendMessage(chatId, '❌ Hozirda mahsulotlar mavjud emas.');
    return;
  }

  const session: OrderSession = {
    userId,
    step: 'selecting_products',
    items: [],
    currentPage: 0,
    ...(forDistributorId && { forDistributorId }),
  };
  orderSessions.set(chatId, session);

  const { keyboard, text } = buildProductPageKeyboard(products, [], 0, false);
  const sent = await bot.sendMessage(chatId, text, {
    reply_markup: { inline_keyboard: keyboard },
  });
  session.lastMessageId = sent.message_id;
  orderSessions.set(chatId, session);
}
```

- [ ] **Step 5: Add handlePageNavigation export**

Add a new exported function:

```typescript
export const handlePageNavigation = async (
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  direction: 'next' | 'prev'
) => {
  try {
    const session = orderSessions.get(chatId);
    if (!session) return;

    session.currentPage += direction === 'next' ? 1 : -1;
    session.currentPage = Math.max(0, session.currentPage);

    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    const selectedIds = session.items.map((i) => i.productId);
    const { keyboard, text } = buildProductPageKeyboard(products, selectedIds, session.currentPage, session.items.length > 0);

    orderSessions.set(chatId, session);

    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: keyboard },
    });
  } catch (error) {
    logger.error('handlePageNavigation error:', error);
  }
};
```

- [ ] **Step 6: Update enterQuantity to use pagination**

Replace the `enterQuantity` function body (lines 131-175) to use `buildProductPageKeyboard`:

```typescript
export const enterQuantity = async (
  bot: TelegramBot,
  chatId: number,
  quantity: number
) => {
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

    const selectedIds = session.items.map((i) => i.productId);
    const { keyboard, text } = buildProductPageKeyboard(products, selectedIds, session.currentPage, true);

    orderSessions.set(chatId, session);

    const sent = await bot.sendMessage(chatId, `${summary}\n${text}`, {
      reply_markup: { inline_keyboard: keyboard },
    });
    session.lastMessageId = sent.message_id;
    orderSessions.set(chatId, session);
  } catch (error) {
    logger.error('enterQuantity error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};
```

- [ ] **Step 7: Export handlePageNavigation and selectDistributor from orderHandler**

Ensure the import in `src/bot/index.ts` (line 9-19) includes the new exports:

```typescript
import {
  startNewOrder,
  selectProduct,
  enterQuantity,
  confirmOrder,
  cancelOrder,
  getOrderSession,
  viewMyOrders,
  isOrderBanned,
  setOrderBan,
  handlePageNavigation,
} from './handlers/orderHandler';
```

- [ ] **Step 8: Add pagination callback handlers in bot/index.ts**

In the callback query handler (after the `select_product` handler around line 744), add:

```typescript
    // Pagination callbacks
    if (data === 'order_page_next' || data === 'order_page_prev') {
      const direction = data === 'order_page_next' ? 'next' : 'prev';
      await handlePageNavigation(bot, chatId, messageId, direction);
      await bot.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'order_page_noop') {
      await bot.answerCallbackQuery(query.id);
      return;
    }
```

- [ ] **Step 9: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 10: Test manually**

Start bot in dev mode and test:
1. As distributor: press "Yangi buyurtma" → see paginated products
2. Navigate pages with ⬅️ ➡️
3. Select product → enter quantity → see remaining products paginated
4. Confirm order works

- [ ] **Step 11: Commit**

```bash
git add src/bot/handlers/orderHandler.ts src/bot/index.ts
git commit -m "feat: add product pagination for order creation (8 per page)"
```

---

## Task 6: Producer creates order on behalf of distributor

**Files:**
- Modify: `src/bot/handlers/orderHandler.ts` (add `selectDistributor`)
- Modify: `src/bot/index.ts:567-571` (pass `userRole` to `startNewOrder`)
- Modify: `src/bot/index.ts` (add `select_distributor` callback, add `selectDistributor` import)

- [ ] **Step 0: Add selectDistributor to imports in bot/index.ts**

Update the import from `./handlers/orderHandler` to include `selectDistributor`:

```typescript
import {
  startNewOrder,
  selectProduct,
  enterQuantity,
  confirmOrder,
  cancelOrder,
  getOrderSession,
  viewMyOrders,
  isOrderBanned,
  setOrderBan,
  handlePageNavigation,
  selectDistributor,
} from './handlers/orderHandler';
```

- [ ] **Step 1: Add selectDistributor export in orderHandler.ts**

Add after `showProductPage`:

```typescript
export const selectDistributor = async (
  bot: TelegramBot,
  chatId: number,
  messageId: number,
  distributorId: string,
  producerUserId: string
) => {
  try {
    const distributor = await prisma.user.findUnique({ where: { id: distributorId } });
    if (!distributor) {
      await bot.sendMessage(chatId, '❌ Distribyutor topilmadi.');
      return;
    }

    // Clear existing session and start product page with forDistributorId
    orderSessions.delete(chatId);
    await showProductPage(bot, chatId, producerUserId, distributorId);
  } catch (error) {
    logger.error('selectDistributor error:', error);
    await bot.sendMessage(chatId, '❌ Xatolik yuz berdi.');
  }
};
```

- [ ] **Step 2: Update confirmOrder to use forDistributorId**

In `confirmOrder` (around lines 207-214), update the order creation to use `forDistributorId` when present:

Replace:
```typescript
        distributorId: session.userId,
```
With:
```typescript
        distributorId: session.forDistributorId || session.userId,
```

The `createdBy` stays as `session.userId` (the producer who created it).

- [ ] **Step 3: Update the "Yangi buyurtma" menu handler in bot/index.ts**

In `src/bot/index.ts`, around lines 567-571, change:

```typescript
      case '📦 Yangi buyurtma':
        const userInfo = await getUserInfo(msg.from.id);
        if (userInfo) {
          await startNewOrder(bot, chatId, userInfo.id, userInfo.role);
        }
        break;
```

- [ ] **Step 4: Add select_distributor callback handler in bot/index.ts**

In the callback query handler, add after the pagination callbacks:

```typescript
    // Distributor selection for producer ordering
    if (data.startsWith('select_distributor:')) {
      const distributorId = data.split(':')[1];
      await selectDistributor(bot, chatId, messageId, distributorId, user.id);
      await bot.answerCallbackQuery(query.id);
      return;
    }
```

- [ ] **Step 5: Update notifyProducers to also notify the distributor**

In `notifyProducers` function, after notifying producers, check if order was created by a different user (producer on behalf) and notify the distributor:

Add at the end of `notifyProducers`, before the outer catch:

```typescript
    // If order was created on behalf of a distributor by producer, notify the distributor
    if (order.createdBy !== order.distributorId) {
      try {
        const distMsg =
          `📦 Sizning nomingizdan buyurtma yaratildi!\n\n` +
          `🔢 ${formatOrderNumber(order.orderSeq)}\n` +
          `📅 ${formatDate(order.orderDate)}\n` +
          `📦 ${order.items.length} ta mahsulot\n` +
          `💰 ${formatPrice(order.totalAmount)}`;

        const distributor = await prisma.user.findUnique({ where: { id: order.distributorId } });
        if (distributor) {
          await bot.sendMessage(Number(distributor.telegramId), distMsg);

          await prisma.notification.create({
            data: {
              userId: distributor.id,
              type: 'ORDER_STATUS',
              title: `Yangi buyurtma ${formatOrderNumber(order.orderSeq)}`,
              message: `Sizning nomingizdan buyurtma yaratildi.`,
              relatedEntityType: 'order',
              relatedEntityId: order.id,
            },
          });
        }
      } catch (e) {
        logger.warn(`Could not notify distributor:`, e);
      }
    }
```

- [ ] **Step 6: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/bot/handlers/orderHandler.ts src/bot/index.ts
git commit -m "feat: allow producer to create orders on behalf of distributors"
```

---

## Task 7: CI/CD — GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the deploy workflow**

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AlwaysData

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.ALWAYSDATA_SSH_HOST }}
          username: ${{ secrets.ALWAYSDATA_SSH_USER }}
          password: ${{ secrets.ALWAYSDATA_SSH_PASSWORD }}
          script: |
            cd ~/manufacture-management-system
            git pull origin main
            npm ci --production=false
            npm run build
            npx prisma migrate deploy
```

Note: Restart step is manual via AlwaysData admin panel. When API key is available, add a `curl` restart step.

- [ ] **Step 2: Verify YAML syntax**

Run: `cat .github/workflows/deploy.yml` and visually verify YAML is valid.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Actions deploy workflow for AlwaysData"
```

---

## Task 8: Run existing tests and verify everything works

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All existing tests pass (66 tests).

- [ ] **Step 2: Run TypeScript compiler check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Fix any failing tests**

If tests reference "Real Taste of Meat" in assertions, update them to "NMM Group Bot".

- [ ] **Step 4: Final commit if test fixes needed**

Stage only the test files that were modified:
```bash
git add src/__tests__/
git commit -m "test: update tests for NMM Group Bot rebrand"
```

---

## Execution Order

Tasks 1-4 are independent and can be done in parallel.
Task 5 (pagination) must be done before Task 6 (producer ordering uses pagination).
Task 7 (CI/CD) is independent.
Task 8 (final verification) must be last.

```
[Task 1: Logger] ──┐
[Task 2: Global errors] ──┤
[Task 3: Approve fix] ──┤──→ [Task 8: Final tests]
[Task 4: Branding] ──┤
[Task 5: Pagination] ──→ [Task 6: Producer ordering] ──┘
[Task 7: CI/CD] ──┘
```
