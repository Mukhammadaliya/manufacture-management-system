# Full Refactor Design — Manufacture Management System
Date: 2026-03-15

## Maqsad

Loyihani soddalashtirib, distribyutor va producer uchun maksimal qulay qilish.

---

## 1. Database Schema O'zgarishlari

### O'chiriladigan narsalar
- `Order.deliveryDate` — o'chiriladi
- `Order.notes` — o'chiriladi
- `Order.orderNumber` — `orderSeq` (autoincrement) bilan almashtiriladi
- `OrderItem.adjustedQuantity` — o'chiriladi
- `OrderItem.adjustmentReason` — o'chiriladi
- `OrderItem.originalQuantity` — o'chiriladi
- `ProductionBatch` model — o'chiriladi
- `ProductionBatchItem` model — o'chiriladi
- `ProductionBatchStatus` enum — o'chiriladi
- `OrderStatus` dan: `SUBMITTED`, `IN_PRODUCTION`, `READY` — o'chiriladi

### Yangi/O'zgartirilgan narsalar

**`OrderStatus` enum (4 ta):**
```
DRAFT       → Kutilmoqda
CONFIRMED   → Tasdiqlangan
DELIVERED   → Yetkazilgan
CANCELLED   → Bekor qilingan
```

**`Product` modeli — yangi maydon:**
```prisma
price Decimal @default(0) @db.Decimal(10, 2)
```

**`Order` modeli — yangi maydon:**
```prisma
orderSeq Int @default(autoincrement()) @map("order_seq")
```

**Audit maydonlari — barcha modellarga:**
```prisma
createdBy String @map("created_by")
updatedBy String @map("updated_by")
```
Qo'shiladi: `Order`, `OrderItem`, `Product`, `User`, `Notification`

### Migration strategiyasi
- `SUBMITTED` → `DRAFT`
- `IN_PRODUCTION` → `CONFIRMED`
- `READY` → `CONFIRMED`
- `deliveryDate` — nullable qilinib, keyin o'chiriladi

---

## 2. Distribyutor Bot Oqimi

### Yangi buyurtma (3 qadam):
1. Mahsulot tanlash (inline tugmalar)
2. Miqdor kiritish (raqam yozish)
3. ✅ Tasdiqlash

- Sana: avtomatik bugun
- Bir nechta mahsulot qo'shish mumkin
- Izoh (notes): yo'q
- Buyurtma raqami: `#1`, `#2`, `#3` ...

### Distribyutor menyu:
```
📦 Yangi buyurtma  |  📋 Buyurtmalarim
🔔 Xabarnomalar    |  👤 Profil
```

### Buyurtmalarim:
- Oxirgi 10 ta buyurtma
- Qisqa ko'rinish: `#3 — Kutilmoqda`

---

## 3. Producer Bot Oqimi

### Producer menyu:
```
📊 Buyurtmalar    |  📈 Hisobotlar
👥 Foydalanuvchilar | 🔔 Xabarnomalar
👤 Profil
```

### Buyurtmalar filtri:
```
📅 Bugun  |  📅 Kecha  |  📅 Ertaga
⏳ Kutilmoqda | ✅ Tasdiqlangan | 📦 Yetkazilgan | ❌ Bekor qilingan
```

### Buyurtma tafsiloti — producer harakatlari:
- ✅ Tasdiqlash / ❌ Bekor qilish / 📦 Yetkazildi (holatga qarab ko'rsatiladi)
- 📝 Miqdor o'zgartirish
- 💰 Narx o'zgartirish
- 📅 Sana o'zgartirish (Bugun / Ertaga / Indinga / 📅 Boshqa sana)

### Status o'tish qoidalari:
```
DRAFT → CONFIRMED yoki CANCELLED
CONFIRMED → DELIVERED yoki CANCELLED
DELIVERED → (o'zgartirib bo'lmaydi)
CANCELLED → (o'zgartirib bo'lmaydi)
```

---

## 4. Producer Bildirishnoma Tizimi

### Yangi buyurtma yaratilganda:
- Barcha PRODUCER/ADMIN foydalanuvchilarga Telegram xabari yuboriladi
- Xabarda inline tugmalar: `✅ Tasdiqlash | ❌ Bekor qilish`
- Shu bilan birga DB'da `Notification` yozuvi yaratiladi

### Xabar formati:
```
🆕 Yangi buyurtma #5

👤 Kompaniya nomi
📅 15-mart 2026
📦 Mahsulotlar: 3 ta

✅ Tasdiqlash | ❌ Bekor qilish
```

### Distribyutorga boriladigan bildirishnomalar:
- Buyurtma holati o'zgarganda
- Miqdor o'zgarganda
- Narx o'zgarganda
- Sana o'zgarganda

---

## 5. Hisobotlar

### Oddiy hisobot (bot ichida):
```
📅 Bugun | 📅 Kecha | 📅 Boshqa sana
```

### Kengaytirilgan Excel hisobot:
**Ixtiyoriy filtrlar:**
- Sana (tanlash yoki o'tkazib yuborish)
- Holat (tanlash yoki o'tkazib yuborish)

**Excel jadval tuzilmasi:**
- Satrlar: Mijoz nomlari
- Ustunlar: Mahsulot nomlari
- Qiymatlar: Miqdorlar
- Oxirgi satr: Jami

**Filtr oqimi:**
1. "📊 Kengaytirilgan hisobot"
2. "📅 Sanani filterlaysizmi?" → Ha / Yo'q
3. "📊 Holatni filterlaysizmi?" → Ha / Yo'q
4. Excel fayl yuboriladi

---

## 6. Umumiy Qoidalar

- Barcha interfeys matnlari o'zbek tilida
- Har bir xabar maksimal qisqa
- Buyurtma raqami: `#N` (global autoincrement)
- `OrderItem.quantity` to'g'ridan-to'g'ri o'zgartiriladi
- Har qanday o'zgarish distribyutorga notification boradi
- Audit: kim, qachon o'zgartirganini `createdBy`/`updatedBy` saqlaydi
