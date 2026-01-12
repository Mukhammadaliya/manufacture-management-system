import { PrismaClient, UserRole, ProductUnit } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed data yaratilmoqda...');

  // 1. Foydalanuvchilarni yaratish
  console.log('👤 Foydalanuvchilar yaratilmoqda...');
  
  const admin = await prisma.user.upsert({
    where: { telegramId: BigInt(111111111) },
    update: {},
    create: {
      telegramId: BigInt(111111111),
      role: UserRole.ADMIN,
      name: 'Admin User',
      phone: '+998901234567',
      isActive: true,
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
    },
  });

  const distributor1 = await prisma.user.upsert({
    where: { telegramId: BigInt(333333333) },
    update: {},
    create: {
      telegramId: BigInt(333333333),
      role: UserRole.DISTRIBUTOR,
      name: 'Distribyutor Aziz',
      phone: '+998901234569',
      companyName: 'Aziz Trade',
      isActive: true,
    },
  });

  const distributor2 = await prisma.user.upsert({
    where: { telegramId: BigInt(444444444) },
    update: {},
    create: {
      telegramId: BigInt(444444444),
      role: UserRole.DISTRIBUTOR,
      name: 'Distribyutor Bobur',
      phone: '+998901234570',
      companyName: 'Bobur Foods',
      isActive: true,
    },
  });

  console.log('✅ Foydalanuvchilar yaratildi');

  // 2. Mahsulotlarni yaratish
  console.log('📦 Mahsulotlar yaratilmoqda...');

  const products = [
    {
      code: 'KOLBASA-001',
      name: 'Doktorskaya kolbasa',
      unit: ProductUnit.KG,
      baseRecipe: {
        ingredients: [
          { name: 'Go\'sht', amount: 70, unit: 'kg' },
          { name: 'Yog\'', amount: 20, unit: 'kg' },
          { name: 'Tuz', amount: 2, unit: 'kg' },
          { name: 'Ziravorlar', amount: 1, unit: 'kg' },
        ],
        yield: 100,
      },
      productionParameters: {
        cookingTime: 120,
        temperature: 75,
        batchSize: 100,
      },
    },
    {
      code: 'KOLBASA-002',
      name: 'Sardelka',
      unit: ProductUnit.KG,
      baseRecipe: {
        ingredients: [
          { name: 'Go\'sht', amount: 65, unit: 'kg' },
          { name: 'Yog\'', amount: 25, unit: 'kg' },
          { name: 'Tuz', amount: 2, unit: 'kg' },
          { name: 'Ziravorlar', amount: 1, unit: 'kg' },
        ],
        yield: 100,
      },
      productionParameters: {
        cookingTime: 90,
        temperature: 70,
        batchSize: 100,
      },
    },
    {
      code: 'KOLBASA-003',
      name: 'Sosiska',
      unit: ProductUnit.KG,
      baseRecipe: {
        ingredients: [
          { name: 'Go\'sht', amount: 60, unit: 'kg' },
          { name: 'Yog\'', amount: 30, unit: 'kg' },
          { name: 'Tuz', amount: 2, unit: 'kg' },
          { name: 'Ziravorlar', amount: 1, unit: 'kg' },
        ],
        yield: 100,
      },
      productionParameters: {
        cookingTime: 60,
        temperature: 65,
        batchSize: 100,
      },
    },
    {
      code: 'KOLBASA-004',
      name: 'Qazi',
      unit: ProductUnit.KG,
      baseRecipe: {
        ingredients: [
          { name: 'Ot go\'shti', amount: 80, unit: 'kg' },
          { name: 'Yog\'', amount: 15, unit: 'kg' },
          { name: 'Tuz', amount: 2, unit: 'kg' },
          { name: 'Ziravorlar', amount: 2, unit: 'kg' },
        ],
        yield: 100,
      },
      productionParameters: {
        cookingTime: 180,
        temperature: 80,
        batchSize: 50,
      },
    },
    {
      code: 'KOLBASA-005',
      name: 'Salami',
      unit: ProductUnit.KG,
      baseRecipe: {
        ingredients: [
          { name: 'Go\'sht', amount: 75, unit: 'kg' },
          { name: 'Yog\'', amount: 20, unit: 'kg' },
          { name: 'Tuz', amount: 2, unit: 'kg' },
          { name: 'Ziravorlar', amount: 2, unit: 'kg' },
        ],
        yield: 100,
      },
      productionParameters: {
        cookingTime: 150,
        temperature: 85,
        batchSize: 80,
      },
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { code: product.code },
      update: {},
      create: product,
    });
  }

  console.log('✅ Mahsulotlar yaratildi');

  // 3. Tizim sozlamalarini yaratish
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
    where: { key: 'default_batch_capacity' },
    update: {},
    create: {
      key: 'default_batch_capacity',
      value: { capacity: 100, unit: 'kg' },
      description: 'Default qozon hajmi',
    },
  });

  console.log('✅ Tizim sozlamalari yaratildi');

  console.log('🎉 Seed data muvaffaqiyatli yaratildi!');
}

main()
  .catch((e) => {
    console.error('❌ Xato yuz berdi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });