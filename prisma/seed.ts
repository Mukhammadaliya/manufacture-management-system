import { PrismaClient, UserRole, ProductUnit, OrderStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seed data yaratilmoqda...');

  // 1. Foydalanuvchilarni yaratish
  console.log('Foydalanuvchilar yaratilmoqda...');

  const admin = await prisma.user.upsert({
    where: { telegramId: BigInt(111111111) },
    update: {},
    create: {
      telegramId: BigInt(111111111),
      role: UserRole.ADMIN,
      name: 'Admin User',
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
      updatedBy: 'SYSTEM',
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
      updatedBy: 'SYSTEM',
    },
  });

  console.log('Foydalanuvchilar yaratildi');

  // 2. Mahsulotlarni yaratish
  console.log('Mahsulotlar yaratilmoqda...');

  const productData = [
    {
      code: 'KOLBASA-001',
      name: 'Doktorskaya kolbasa',
      unit: ProductUnit.KG,
      price: 45000,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    {
      code: 'KOLBASA-002',
      name: 'Krakovskaya kolbasa',
      unit: ProductUnit.KG,
      price: 52000,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    {
      code: 'SOSISKA-001',
      name: "Mol go'shtli sosiska",
      unit: ProductUnit.KG,
      price: 38000,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    {
      code: 'SOSISKA-002',
      name: 'Tovuq sosiska',
      unit: ProductUnit.KG,
      price: 32000,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
    {
      code: 'VETCHINA-001',
      name: 'Vet\u00e7ina',
      unit: ProductUnit.KG,
      price: 58000,
      createdBy: admin.id,
      updatedBy: admin.id,
    },
  ];

  const products: Record<string, { id: string; price: import('@prisma/client').Prisma.Decimal }> = {};

  for (const p of productData) {
    const product = await prisma.product.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
    products[p.code] = product;
  }

  console.log('Mahsulotlar yaratildi');

  // 3. Buyurtmalar yaratish
  console.log('Buyurtmalar yaratilmoqda...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  // Order 1 - distributor1, CONFIRMED
  const order1Items = [
    {
      productId: products['KOLBASA-001'].id,
      quantity: 50,
      unitPrice: Number(products['KOLBASA-001'].price),
      totalPrice: 50 * Number(products['KOLBASA-001'].price),
      createdBy: distributor1.id,
      updatedBy: distributor1.id,
    },
    {
      productId: products['SOSISKA-001'].id,
      quantity: 30,
      unitPrice: Number(products['SOSISKA-001'].price),
      totalPrice: 30 * Number(products['SOSISKA-001'].price),
      createdBy: distributor1.id,
      updatedBy: distributor1.id,
    },
  ];
  const order1Total = order1Items.reduce((sum, item) => sum + item.totalPrice, 0);

  const order1 = await prisma.order.create({
    data: {
      distributorId: distributor1.id,
      orderDate: twoDaysAgo,
      status: OrderStatus.CONFIRMED,
      totalAmount: order1Total,
      createdBy: distributor1.id,
      updatedBy: admin.id,
      items: {
        create: order1Items,
      },
    },
  });

  // Order 2 - distributor2, DELIVERED
  const order2Items = [
    {
      productId: products['KOLBASA-002'].id,
      quantity: 40,
      unitPrice: Number(products['KOLBASA-002'].price),
      totalPrice: 40 * Number(products['KOLBASA-002'].price),
      createdBy: distributor2.id,
      updatedBy: distributor2.id,
    },
    {
      productId: products['VETCHINA-001'].id,
      quantity: 20,
      unitPrice: Number(products['VETCHINA-001'].price),
      totalPrice: 20 * Number(products['VETCHINA-001'].price),
      createdBy: distributor2.id,
      updatedBy: distributor2.id,
    },
  ];
  const order2Total = order2Items.reduce((sum, item) => sum + item.totalPrice, 0);

  const order2 = await prisma.order.create({
    data: {
      distributorId: distributor2.id,
      orderDate: yesterday,
      status: OrderStatus.DELIVERED,
      totalAmount: order2Total,
      createdBy: distributor2.id,
      updatedBy: admin.id,
      items: {
        create: order2Items,
      },
    },
  });

  // Order 3 - distributor1, DRAFT
  const order3Items = [
    {
      productId: products['SOSISKA-002'].id,
      quantity: 25,
      unitPrice: Number(products['SOSISKA-002'].price),
      totalPrice: 25 * Number(products['SOSISKA-002'].price),
      createdBy: distributor1.id,
      updatedBy: distributor1.id,
    },
  ];
  const order3Total = order3Items.reduce((sum, item) => sum + item.totalPrice, 0);

  const order3 = await prisma.order.create({
    data: {
      distributorId: distributor1.id,
      orderDate: today,
      status: OrderStatus.DRAFT,
      totalAmount: order3Total,
      createdBy: distributor1.id,
      updatedBy: distributor1.id,
      items: {
        create: order3Items,
      },
    },
  });

  console.log('Buyurtmalar yaratildi');

  // 4. OrderStatusHistory yaratish
  console.log('Order status history yaratilmoqda...');

  // Order 1 history: DRAFT -> CONFIRMED
  await prisma.orderStatusHistory.createMany({
    data: [
      {
        orderId: order1.id,
        status: OrderStatus.DRAFT,
        changedBy: distributor1.id,
        notes: 'Buyurtma yaratildi',
      },
      {
        orderId: order1.id,
        status: OrderStatus.CONFIRMED,
        changedBy: admin.id,
        notes: 'Buyurtma tasdiqlandi',
      },
    ],
  });

  // Order 2 history: DRAFT -> CONFIRMED -> DELIVERED
  await prisma.orderStatusHistory.createMany({
    data: [
      {
        orderId: order2.id,
        status: OrderStatus.DRAFT,
        changedBy: distributor2.id,
        notes: 'Buyurtma yaratildi',
      },
      {
        orderId: order2.id,
        status: OrderStatus.CONFIRMED,
        changedBy: admin.id,
        notes: 'Buyurtma tasdiqlandi',
      },
      {
        orderId: order2.id,
        status: OrderStatus.DELIVERED,
        changedBy: producer.id,
        notes: 'Buyurtma yetkazib berildi',
      },
    ],
  });

  // Order 3 history: DRAFT
  await prisma.orderStatusHistory.create({
    data: {
      orderId: order3.id,
      status: OrderStatus.DRAFT,
      changedBy: distributor1.id,
      notes: 'Buyurtma yaratildi',
    },
  });

  console.log('Order status history yaratildi');

  // 5. Tizim sozlamalarini yaratish
  console.log('Tizim sozlamalari yaratilmoqda...');

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
    update: {},
    create: {
      key: 'app_version',
      value: { version: '2.0.0' },
      description: 'Ilova versiyasi',
    },
  });

  console.log('Tizim sozlamalari yaratildi');

  console.log('Seed data muvaffaqiyatli yaratildi!');
}

main()
  .catch((e) => {
    console.error('Xato yuz berdi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
