# Measure (O'lchov birligi) Feature Design

**Sana:** 2026-04-07
**Maqsad:** Mahsulotlarga o'lchov birligi (dona/kg) tushunchasini qo'shish

---

## 1. Umumiy ko'rinish

Hozirgi tizimda `ProductUnit` enum (`KG`, `PIECE`) mavjud, lekin barcha 44 mahsulot `KG` sifatida belgilangan. Bu dizayn enum ni alohida `Measure` reference jadval bilan almashtiradi va har bir mahsulotga to'g'ri o'lchov birligini tayinlaydi.

## 2. Ma'lumotlar bazasi o'zgarishlari

### Yangi `Measure` jadval

```prisma
model Measure {
  id        Int       @id @default(autoincrement())
  name      String    // "Dona", "Kilogramm"
  shortName String    // "dona", "kg" — bot va hisobotlarda ko'rinadi
  createdAt DateTime  @default(now())
  products  Product[]
}
```

### Seed ma'lumotlari

| id | name       | shortName |
|----|------------|-----------|
| 1  | Dona       | dona      |
| 2  | Kilogramm  | kg        |

### `Product` jadval o'zgarishi

- Yangi `measureId Int` (FK → Measure) field qo'shiladi
- Eski `unit ProductUnit` field o'chiriladi
- `ProductUnit` enum o'chiriladi

### Mahsulotlar va ularning o'lchov birliklari

**DONA (measureId: 1):**
- Bazarski 0.5
- Bazarski 0.6
- Bazarski New 0.5
- Bazarski New 0.6
- Bavarski 0.5
- Bavarski 0.6
- Yangi toshkent 0.6
- Ser az 0.3
- Ser az 0.4
- Ser az 0.5 ingichka
- Ser az 0.5 qalin
- Ser az 0.6 ingichka
- Ser az 0.6 qalin
- Ser az 0.7 ingichka
- Ser az 0.7 qalin
- Ser az 0.8
- Ramazon 0.8

**KG (measureId: 2):**
- Doktor
- Zaftrk
- Doktor Arzon
- Zaftrk arzon
- Sasika
- Tigr
- Sasiska arzon
- Tigr arzon
- Tallin
- Jorj
- Mahkamov bomba
- Arqon bomba
- Mahkamov brend
- Servelat bomba
- Indeyka
- Yangilik gosht
- Pokon
- Pokon arzon
- Salyami 0.5
- Salyami 0.6
- Setka 0.3
- Setka 0.4
- Baton bomba
- Garadskoy
- Chimkent
- Eston
- Prima

### Migratsiya ketma-ketligi (bitta Prisma migration)

1. `Measure` jadval yaratiladi
2. `Measure` ga 2 ta qator insert: `(1, 'Dona', 'dona')`, `(2, 'Kilogramm', 'kg')`
3. `Product` ga `measureId` column qo'shiladi (nullable)
4. Mavjud mahsulotlar yuqoridagi ro'yxat bo'yicha yangilanadi — har biriga to'g'ri `measureId`
5. `measureId` NOT NULL qilinadi + foreign key constraint qo'shiladi
6. Eski `unit` column drop qilinadi
7. `ProductUnit` enum drop qilinadi

## 3. Kod o'zgarishlari

### Prisma schema (`prisma/schema.prisma`)
- `ProductUnit` enum o'chiriladi
- `Measure` model qo'shiladi
- `Product.unit` → `Product.measureId` + `Product.measure` relation

### Zod validatsiya (`src/utils/validators.ts`)
- `unit: z.enum(['KG', 'PIECE'])` → `measureId: z.number().int()`

### API controller (`src/controllers/productController.ts`)
- Product yaratish/yangilashda `measureId` qabul qiladi
- Product qaytarishda `include: { measure: true }`

### Bot order handler (`src/bot/handlers/orderHandler.ts`)
- `product.unit` → `product.measure.shortName`
- Session items da `unit` o'rniga `measure.shortName` saqlanadi
- Namuna: `"🔢 Miqdorni kiriting (dona):"`, `"Bazarski 0.5 — 100 dona"`

### Producer handler (`src/bot/handlers/producerHandler.ts`)
- `item.product.unit` → `item.product.measure.shortName`
- Barcha display joylarida kichik harfda ko'rinadi

### Excel hisobot (`src/bot/utils/excelReport.ts`)
- Ustun sarlavhasi: `"Bazarski 0.5 (dona)"`, `"Doktor (kg)"`
- `item.product.unit` → `item.product.measure.shortName`

### Order helpers (`src/bot/utils/orderHelpers.ts`)
- Unit display — `measure.shortName` ishlatadi

### Seed (`prisma/seed.ts`)
- Avval `Measure` jadval seed qilinadi
- Mahsulotlar to'g'ri `measureId` bilan yaratiladi

### Prisma query lar
- Product so'rovlarga `include: { measure: true }` qo'shiladi

## 4. Display formati

- Bot xabarlari: kichik harfda — `"dona"`, `"kg"`
- Excel hisobot ustun sarlavhasi: `"Mahsulot nomi (dona)"`, `"Mahsulot nomi (kg)"`
- Miqdor ko'rinishi: `"100 dona"`, `"50.5 kg"`

## 5. Deploy strategiyasi

1. Kod push → GitHub Actions trigger
2. CI: build + prisma generate + deploy
3. Serverda: `npx prisma migrate deploy`
4. Server restart

Migratsiya bitta tranzaksiyada — xato bo'lsa rollback. Mavjud `OrderItem` larga ta'sir yo'q — ular `product.measure` relation orqali yangi o'lchov birligini ko'radi.

## 6. Ta'sir doirasi

- Mavjud buyurtmalarga ta'sir yo'q
- Foydalanuvchi interfeysi o'zgarmaydi — faqat "KG" o'rniga "dona"/"kg" ko'rinadi
- API response da `unit` string o'rniga `measure` object keladi
- Yangi o'lchov birligi qo'shish — faqat `Measure` jadvalga `INSERT`
