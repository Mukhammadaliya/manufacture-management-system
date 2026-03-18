import { z } from 'zod';

// Berilgan UTC vaqtni Toshkent (UTC+5) sanasiga aylantiradi
export function toTashkentDate(date: Date): Date {
  const tashkentOffset = 5 * 60;
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const tashkent = new Date(utc + tashkentOffset * 60000);
  return new Date(Date.UTC(tashkent.getFullYear(), tashkent.getMonth(), tashkent.getDate()));
}

// User validation
export const createUserSchema = z.object({
  body: z.object({
    telegramId: z.string().or(z.number()),
    role: z.enum(['DISTRIBUTOR', 'PRODUCER', 'ADMIN']),
    name: z.string().min(2, 'Ism kamida 2 ta belgidan iborat bo\'lishi kerak'),
    phone: z.string().optional(),
    companyName: z.string().optional(),
  }),
});

// Product validation
export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3, 'Nomi kamida 3 ta belgidan iborat bo\'lishi kerak'),
    code: z.string().min(3, 'Kod kamida 3 ta belgidan iborat bo\'lishi kerak'),
    unit: z.enum(['KG', 'PIECE']),
  }),
});

// Order validation
export const createOrderSchema = z.object({
  body: z.object({
    distributorId: z.string().uuid('Noto\'g\'ri distribyutor ID'),
    orderDate: z.string().datetime().or(z.date()),
    items: z.array(
      z.object({
        productId: z.string().uuid('Noto\'g\'ri mahsulot ID'),
        quantity: z.number().positive('Miqdor musbat son bo\'lishi kerak'),
      })
    ).min(1, 'Kamida bitta mahsulot bo\'lishi kerak'),
  }),
});

// Update order status validation
export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      'DRAFT',
      'CONFIRMED',
      'DELIVERED',
      'CANCELLED',
    ]),
  }),
});
