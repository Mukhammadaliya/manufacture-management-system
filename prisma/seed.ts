import { PrismaClient, UserRole, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Production seed data yaratilmoqda...');

  // Cleanup — re-run safe
  console.log('🧹 Eski ma\'lumotlar tozalanmoqda...');
  await prisma.orderStatusHistory.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.product.deleteMany({});
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

  // 1. Foydalanuvchilarni yaratish (Admin va Producer)
  console.log('👤 Foydalanuvchilar yaratilmoqda...');

  const admin = await prisma.user.upsert({
    where: { telegramId: BigInt(111111111) },
    update: {},
    create: {
      telegramId: BigInt(111111111),
      role: UserRole.ADMIN,
      name: 'Admin',
      phone: '+998901234567',
      isActive: true,
      updatedBy: 'SYSTEM',
    },
  });

  const producer = await prisma.user.upsert({
    where: { telegramId: BigInt(222222222) },
    update: {},
    create: {
      telegramId: BigInt(222222222),
      role: UserRole.PRODUCER,
      name: 'Ishlab chiqaruvchi',
      phone: '+998901234568',
      isActive: true,
      updatedBy: 'SYSTEM',
    },
  });

  console.log('✅ Foydalanuvchilar yaratildi');

  // 2. Mahsulotlarni yaratish (faqat mahsulotlar, default data yo'q)
  console.log('📦 Mahsulotlar yaratilmoqda...');

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

    // === SER AZ (turli o'lchamlar) === (dona)
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

  let createdCount = 0;
  for (const p of productData) {
    await prisma.product.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        measureId: p.measureId,
        updatedBy: admin.id,
      },
      create: {
        ...p,
        createdBy: admin.id,
        updatedBy: admin.id,
      },
    });
    createdCount++;
  }

  console.log(`✅ ${createdCount} ta mahsulot yaratildi`);

  // 3. Tizim sozlamalari
  console.log('⚙️ Tizim sozlamalari yaratilmoqda...');

  await prisma.orderTimeSetting.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      orderStartTime: '04:00',
      orderEndTime: '16:00',
      notificationBeforeClose: 30,
      isActive: true,
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'app_version' },
    update: { value: { version: '2.0.0' } },
    create: {
      key: 'app_version',
      value: { version: '2.0.0' },
      description: 'Ilova versiyasi',
    },
  });

  console.log('✅ Tizim sozlamalari yaratildi');

  console.log('');
  console.log('========================================');
  console.log('🎉 Production seed muvaffaqiyatli yaratildi!');
  console.log(`📦 Mahsulotlar: ${createdCount} ta`);
  console.log('👤 Admin: telegramId 111111111');
  console.log('👤 Producer: telegramId 222222222');
  console.log('⚠️  Default buyurtmalar yaratilMADI');
  console.log('⚠️  Narxlar 0 — admin paneldan o\'rnating');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('❌ Xato yuz berdi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
