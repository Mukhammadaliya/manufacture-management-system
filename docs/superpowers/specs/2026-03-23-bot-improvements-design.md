# NMM Group Bot — Yaxshilashlar dizayn hujjati

**Sana:** 2026-03-23
**Status:** Tasdiqlangan

---

## Muammolar va xususiyatlar ro'yxati

1. **Bug fix**: Distribyutor tasdiqlangandan keyin `/start` javob bermaydi
2. **Branding**: "Real Taste of Meat" → "NMM Group Bot" (hamma joyda)
3. **Feature**: Buyurtma yaratishda mahsulotlar uchun pagination
4. **Feature**: Ishlab chiqaruvchi distribyutor nomidan buyurtma yaratishi
5. **Feature**: CI/CD — GitHub Actions + SSH orqali auto-deploy

---

## 1. Bug fix: /start javob bermaydi

### Muammo

Distribyutor sifatida ro'yxatdan o'tib, ishlab chiqaruvchi tomonidan tasdiqlangandan keyin, distribyutor `/start` bosganda bot javob bermaydi. Loglar mavjud emas (o'chib ketgan).

### Yechim

**Diagnostik logging:**
- `/start` handler ichidagi har bir bosqichga `logger.debug()` qo'shish:
  - `findUser()` natijasi
  - `user.isActive` holati
  - `getMainKeyboard()` chaqiruvi
  - `sendMessage()` natijasi

**Potentsial bug sabablar va tuzatishlar:**
- `handleApproveUser` dagi `Number(user.telegramId)` — BigInt xavfsiz konvertatsiya
- `handleApproveUser` (1205-1211 qatorlar) — notification xabarida `**Tabriklaymiz!**` Markdown sintaksisi ishlatilgan, lekin `parse_mode: 'Markdown'` berilmagan. Tuzatish: `parse_mode: 'Markdown'` qo'shish
- `parse_mode: 'Markdown'` ishlatilgan BOSHQA joylardagi maxsus belgilar (`_`, `*`, `[`, `]`) escape qilish — Telegram Markdown parse xatosi botni turib qoldirishi mumkin
- Global `unhandledRejection` va `uncaughtException` handlerlar qo'shish (`src/index.ts`)

**Tegishli fayllar:**
- `src/bot/index.ts` — `/start` handler (146-207 qatorlar)
- `src/bot/handlers/producerHandler.ts` — `handleApproveUser` (1186-1225 qatorlar)
- `src/bot/utils/userManager.ts` — `findUser` funksiyasi
- `src/index.ts` — global error handlerlar

### Log boshqaruv (tekin server himoyasi)

AlwaysData tekin plani — disk 50% to'la. Hozirgi Winston logger konfiguratsiyasi o'zgartiriladi (mavjud qiymatlar: level=`info`, maxSize=5MB, maxFiles=5):

- **Maksimal fayl hajmi:** 2MB per log file (hozirgi 5MB dan kamaytiriladi)
- **Maksimal fayllar soni:** 3 ta (hozirgi 5 dan kamaytiriladi, eski loglar avtomatik o'chiriladi — rotation)
- **Production da:** faqat `warn` va `error` darajasi yoziladi (hozirgi `info` dan o'zgartiriladi)
- **Debug loglar:** faqat `NODE_ENV=development` da yonadi
- **Natija:** loglar maksimum ~6MB band qiladi

**Tegishli fayl:** `src/utils/logger.ts`

---

## 2. Branding: "Real Taste of Meat" → "NMM Group Bot"

### O'zgartirish

Butun codebase bo'ylab "Real Taste of Meat" → "NMM Group Bot" almashtiriladi. Emoji (`🥩`) o'zgarishsiz qoladi. Implementatsiyada codebase-wide search (`grep -r`) qilinib, barcha occurrences topiladi (test fayllar, env namunalar ham).

### Asosiy tegishli fayllar (to'liq ro'yxat search orqali aniqlanadi)

| Fayl | O'zgartirish |
|------|-------------|
| `src/bot/index.ts` | Welcome message (~160, ~192 qatorlar) |
| `src/bot/utils/messages.ts` | `MESSAGES.WELCOME` va boshqa joylar |
| `README.md` | Sarlavha va tavsiflar |
| `DEPLOYMENT-ALWAYSDATA.md` | Sarlavha va havolalar |
| `package.json` | `description` maydoni |

---

## 3. Buyurtmada Pagination

### Hozirgi holat

Barcha mahsulotlar (40+ ta) bir vaqtda inline button sifatida ko'rsatiladi. Cheklangan — `take: 20`.

### Yangi dizayn

**Sahifa tuzilishi:**
- Mahsulotlar alifbo tartibida saralanadi (A→Z)
- Har sahifada **8 ta** mahsulot — inline button sifatida
- Pastda navigatsiya qatori: `⬅️` `📄 1/5` `➡️`
- Tanlangan mahsulotlar ro'yxatdan chiqariladi, sahifa raqamlari qayta hisoblanadi

**UI misol:**
```
📦 Mahsulot tanlang (1/5):

[Bavarski kolbasa — 45,000]
[Bazarski kolbasa — 38,000]
[Doktorskaya — 52,000]
[Frankfurter sosiska — 41,000]
[Krakovski — 48,000]
[Lyubityelski — 35,000]
[Moskovski — 55,000]
[Ohotnichilar — 42,000]

[⬅️]  [📄 1/5]  [➡️]
```

**Texnik yechim:**

`OrderSession` interfeysi kengaytiriladi:
```typescript
interface OrderSession {
  userId: string;
  step: 'selecting_products' | 'entering_quantity';
  items: Array<{ productId, productName, unit, quantity, unitPrice }>;
  currentPage: number;  // YANGI — boshlang'ich qiymati 0 (0-indexed)
  forDistributorId?: string;  // YANGI (4-bo'lim uchun)
}
```

**Callback data:**
- `order_page_next` — keyingi sahifa
- `order_page_prev` — oldingi sahifa
- `select_product:{id}` — mahsulot tanlash (mavjud)

**Xatti-harakat:**
- Sahifa o'zgarganda `editMessageReplyMarkup` bilan inline keyboard yangilanadi (yangi xabar yuborilmaydi)
- Birinchi sahifada (page=0) `⬅️` tugmasi ko'rsatilmaydi (olib tashlanadi), oxirgi sahifada `➡️` ko'rsatilmaydi
- Mahsulot tanlanib, miqdor kiritilgandan keyin, foydalanuvchi oxirgi ko'rgan sahifaga qaytadi
- **Edge case:** agar tanlangan mahsulotlar tufayli sahifalar soni kamayganda `currentPage` chegaradan chiqsa, `currentPage = Math.min(currentPage, maxPage)` bilan clamp qilinadi

**Tegishli fayllar:**
- `src/bot/handlers/orderHandler.ts` — `startNewOrder`, `selectProduct`, paginatsiya logikasi

---

## 4. Ishlab chiqaruvchi distribyutor nomidan buyurtma

### Oqim

```
Producer "📦 Yangi buyurtma" bosadi
  → Faol distribyutorlar ro'yxati (inline buttons)
    → Distribyutor tanlaydi
      → Oddiy buyurtma flow (pagination bilan mahsulot → miqdor → tasdiqlash)
```

**Distribyutor tanlash UI:**
```
👥 Qaysi distribyutor uchun buyurtma yaratmoqchisiz?

[Avazbek — "Toshkent Savdo"]
[Bobur — "Samarqand Food"]
[Dilshod — "Farg'ona Trade"]
```

### Texnik yechim

- `startNewOrder` funksiyasi signaturesiga `userRole: string` parametri qo'shiladi: `startNewOrder(bot, chatId, userId, userRole)`
- Agar `userRole === 'PRODUCER' || userRole === 'ADMIN'` → avval distribyutor tanlash bosqichi
- Agar `userRole === 'DISTRIBUTOR'` → to'g'ridan-to'g'ri mahsulot tanlashga o'tadi
- `OrderSession.forDistributorId` — tanlangan distribyutor ID si
- Callback: `select_distributor:{userId}`
- Buyurtma yaratilganda: `distributorId = forDistributorId`, `createdBy = producer.id` (bot Prisma create call da ham `createdBy` to'g'ri set qilinadi)
- Distribyutorga buyurtma haqida notification yuboriladi
- Distribyutorlar soni ko'p bo'lsa — pagination logikasi qayta ishlatiladi (8 ta per sahifa)

**Cheklovlar:**
- Faqat `isActive: true` va `role: DISTRIBUTOR` foydalanuvchilar ko'rinadi
- **Edge case:** agar faol distribyutorlar bo'lmasa — "Faol distribyutorlar topilmadi" xabari ko'rsatiladi

**Tegishli fayllar:**
- `src/bot/handlers/orderHandler.ts` — `startNewOrder` kengaytirish
- `src/bot/index.ts` — `select_distributor` callback handler
- `src/controllers/orderController.ts` — `createOrder` (allaqachon `distributorId` ni body dan qabul qiladi)

---

## 5. CI/CD: GitHub Actions + SSH

### Workflow

**Trigger:** `main` branchga push

**Bosqichlar:**

| # | Bosqich | Buyruq |
|---|---------|--------|
| 1 | SSH ulanish | `appleboy/ssh-action` GitHub Action orqali (xavfsizroq) |
| 2 | Kodni yangilash | `cd ~/app && git pull origin main` |
| 3 | Dependencies | `npm ci --production=false` |
| 4 | Build | `npm run build` |
| 5 | DB migrate | `npx prisma migrate deploy` |
| 6 | Restart | Qo'lda — AlwaysData admin panelidan (keyinchalik API key bilan avtomatlashtiriladi) |

**GitHub Secrets (repository settings):**
- `ALWAYSDATA_SSH_HOST` — server manzili (ssh-{account}.alwaysdata.net)
- `ALWAYSDATA_SSH_USER` — username
- `ALWAYSDATA_SSH_PASSWORD` — parol

**Xavfsizlik:**
- Parol faqat GitHub encrypted secrets da saqlanadi
- `appleboy/ssh-action` GitHub Action ishlatiladi (`sshpass` o'rniga — xavfsizroq, parol process listing da ko'rinmaydi)
- Workflow faqat `main` branch push da ishlaydi

**Kelajakda:**
- AlwaysData API key olinsa, 6-bosqich ham avtomatlashtiriladi (`curl -X POST` bilan site restart)
- SSH key authentication ga o'tish tavsiya etiladi

**Yangi fayl:** `.github/workflows/deploy.yml`

---

## Umumiy ta'sir ko'lami

### O'zgartiriladigan fayllar

| Fayl | O'zgartirish turi |
|------|-------------------|
| `src/bot/index.ts` | Bug fix, branding, callback handlers |
| `src/bot/handlers/orderHandler.ts` | Pagination, distributor tanlash |
| `src/bot/utils/messages.ts` | Branding |
| `src/bot/utils/userManager.ts` | (tekshirish, zarur bo'lsa tuzatish) |
| `src/bot/handlers/producerHandler.ts` | handleApproveUser tuzatish |
| `src/utils/logger.ts` | Log rotation va level boshqaruv |
| `src/index.ts` | Global error handlers |
| `README.md` | Branding |
| `DEPLOYMENT-ALWAYSDATA.md` | Branding |
| `package.json` | Branding |

### Yangi fayllar

| Fayl | Maqsad |
|------|--------|
| `.github/workflows/deploy.yml` | CI/CD workflow |
