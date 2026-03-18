# 🚀 Deployment Guide — AlwaysData.com

## Real Taste of Meat — Manufacture Management System

---

## 1. AlwaysData Platformasi Tahlili

### Umumiy Ma'lumot
AlwaysData — Yevropada joylashgan fully managed cloud hosting platformasi. Loyihamiz uchun kerakli barcha texnologiyalarni qo'llab-quvvatlaydi.

### Loyiha Talablari va Moslik

| Talab | AlwaysData Qo'llab-quvvatlashi | Holat |
|-------|-------------------------------|-------|
| Node.js 18+ | Node.js 6-22 versiyalari | ✅ |
| PostgreSQL 15+ | PostgreSQL (managed, unlimited) | ✅ |
| Express.js | Node.js site type orqali | ✅ |
| SSH Access | Barcha planlarda | ✅ |
| SSL/HTTPS | Let's Encrypt (bepul, avtomatik) | ✅ |
| Cron Jobs | Scheduled tasks mavjud | ✅ |
| Background Services | Daemon rejimi mavjud | ✅ |

### Tavsiya Etiladigan Plan: **Plus Small** (€5/oy)

- 50 GB SSD disk
- 1 GB RAM
- 1 CPU
- 7 kunlik backup
- Unlimited sites, databases, email
- SSH access
- 30 kun bepul sinov

> **Eslatma:** Free plan (100MB, 256MB RAM) development/test uchun yaraydi, lekin production uchun Plus Small minimal tavsiya.

---

## 2. Account Yaratish

1. https://www.alwaysdata.com/en/register/ sahifasiga o'ting
2. "Plus Small" tanlang (yoki avval Free bilan test qiling)
3. Email, parol kiriting
4. Account nomlari: `realtaste` (yoki o'zingiz xohlagan nom)

---

## 3. PostgreSQL Database Sozlash

### Admin Panel orqali:

1. **Databases > PostgreSQL** bo'limiga o'ting
2. **"Add a database"** tugmasini bosing:
   - Database name: `realtaste_manufacture_db`
   - Encoding: `UTF-8`
3. **User yaratish** (agar default user ishlatmayotgan bo'lsangiz):
   - Username: `realtaste`
   - Password: kuchli parol o'rnating

### Connection URL formati:
```
postgresql://realtaste:YOUR_PASSWORD@postgresql-realtaste.alwaysdata.net:5432/realtaste_manufacture_db
```

> **Muhim:** `postgresql-realtaste` — bu sizning account nomingiz. Aniq qiymatni admin paneldan tekshiring.

---

## 4. SSH orqali Serverga Ulanish

```bash
ssh realtaste@ssh-realtaste.alwaysdata.net
```

Yoki SSH key orqali:
1. Admin panel > **Remote Access > SSH** bo'limiga o'ting
2. Public SSH key'ingizni qo'shing
3. Parolsiz ulanish imkoni

---

## 5. Loyihani Deploy Qilish

### 5.1 Repository Clone Qilish

```bash
# SSH orqali serverga ulaning
ssh realtaste@ssh-realtaste.alwaysdata.net

# Home directory'da
cd ~
git clone https://github.com/YOUR_USERNAME/manufacture-management-system.git app
cd app
```

### 5.2 Node.js Versiyasini Sozlash

Admin panel > **Environment > Node.js** bo'limida Node.js 18 versiyasini tanlang.

### 5.3 Dependencies O'rnatish

```bash
cd ~/app
npm ci --production=false  # devDependencies ham kerak (prisma, typescript)
```

### 5.4 Environment Variables

```bash
# .env faylini yarating
cat > ~/app/.env << 'EOF'
# Database
DATABASE_URL="postgresql://realtaste:YOUR_PASSWORD@postgresql-realtaste.alwaysdata.net:5432/realtaste_manufacture_db"

# JWT
JWT_SECRET="your-super-secret-jwt-key-minimum-32-characters-long"

# Telegram Bot
BOT_TOKEN="your-telegram-bot-token-from-botfather"

# App
NODE_ENV=production
PORT=8100
HOST=0.0.0.0

# Tashkent timezone
TZ=Asia/Tashkent
EOF
```

> **Muhim:** PORT va HOST qiymatlarini admin paneldagi site sozlamalaridan oling. AlwaysData `HOST` va `PORT` environment variable'larini o'zi beradi.

### 5.5 Build va Migrate

```bash
cd ~/app

# TypeScript build
npm run build

# Prisma generate
npx prisma generate

# Database migration
npx prisma migrate deploy

# Seed (mahsulotlar va boshlang'ich ma'lumotlar)
npm run seed
```

### 5.6 Node.js Site Yaratish (Admin Panel)

1. **Web > Sites** bo'limiga o'ting
2. **"Add a site"** tugmasini bosing
3. Sozlamalar:
   - **Type:** Node.js
   - **Addresses:** `realtaste.alwaysdata.net` (yoki o'z domayningiz)
   - **Working directory:** `/app/`
   - **Command:** `node dist/index.js`
   - **Node.js version:** 18.x
   - **Environment variables:**
     ```
     NODE_ENV=production
     ```

> **Muhim:** AlwaysData `HOST` va `PORT` ni avtomatik beradi. Kod bu env variable'larni o'qishi kerak.

---

## 6. Kodni HOST/PORT ga Moslashtirish

`src/index.ts` da quyidagi o'zgarish kerak (agar hali qilinmagan bo'lsa):

```typescript
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(Number(PORT), HOST, () => {
  logger.info(`🚀 Server ishga tushdi: http://${HOST}:${PORT}`);
});
```

AlwaysData serverda `HOST` va `PORT` environment variable'larini beradi — app ularga listen qilishi shart.

---

## 7. Telegram Bot Sozlash

Bot production serverda ishlashi uchun:

1. BotFather dan BOT_TOKEN oling
2. `.env` faylga qo'shing
3. Bot webhook yoki polling rejimida ishlaydi

Agar webhook ishlatmoqchi bo'lsangiz:
```
https://realtaste.alwaysdata.net/api/webhook/telegram
```

---

## 8. Custom Domain (Ixtiyoriy)

1. **Domains** bo'limida domain qo'shing
2. DNS sozlamalari:
   - A record: AlwaysData IP ga yo'naltiring
   - CNAME: `realtaste.alwaysdata.net` ga
3. SSL avtomatik Let's Encrypt bilan faollashadi

---

## 9. Monitoring va Maintenance

### Loglarni ko'rish:
```bash
ssh realtaste@ssh-realtaste.alwaysdata.net
tail -f ~/app/logs/app.log   # Winston logs (agar sozlangan bo'lsa)
```

### Admin panelda:
- **Web > Sites > Logs** — HTTP access loglar
- **Web > Sites > Error logs** — stderr loglar

### Restart:
Admin panel > **Web > Sites** > saytni restart qiling

### Yangilash (update deploy):
```bash
ssh realtaste@ssh-realtaste.alwaysdata.net
cd ~/app
git pull origin main
npm ci
npm run build
npx prisma migrate deploy
# Admin paneldan saytni restart qiling
```

---

## 10. Backup Strategiyasi

AlwaysData avtomatik backup qiladi (7-30 kun planga qarab). Qo'shimcha:

```bash
# Manual database backup
pg_dump -h postgresql-realtaste.alwaysdata.net -U realtaste -d realtaste_manufacture_db > backup_$(date +%Y%m%d).sql
```

---

## Xulosa

AlwaysData sizning loyihangiz uchun yaxshi tanlov:
- Node.js 18+ to'liq qo'llab-quvvatlanadi
- PostgreSQL managed va unlimited
- SSH access bilan to'liq nazorat
- €5/oy dan boshlanadi (30 kun bepul)
- Yevropa serverlarida ma'lumot xavfsizligi
- Avtomatik SSL va backup

**Keyingi qadam:** Account ochib, yuqoridagi qadamlarni ketma-ket bajaring.
