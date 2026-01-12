import { z } from 'zod';

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
    baseRecipe: z.any().optional(),
    productionParameters: z.any().optional(),
  }),
});

// Order validation
export const createOrderSchema = z.object({
  body: z.object({
    distributorId: z.string().uuid('Noto\'g\'ri distribyutor ID'),
    orderDate: z.string().datetime().or(z.date()),
    deliveryDate: z.string().datetime().or(z.date()),
    items: z.array(
      z.object({
        productId: z.string().uuid('Noto\'g\'ri mahsulot ID'),
        quantity: z.number().positive('Miqdor musbat son bo\'lishi kerak'),
      })
    ).min(1, 'Kamida bitta mahsulot bo\'lishi kerak'),
    notes: z.string().optional(),
  }),
});

// Update order status validation
export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum([
      'DRAFT',
      'SUBMITTED',
      'CONFIRMED',
      'IN_PRODUCTION',
      'READY',
      'DELIVERED',
      'CANCELLED',
    ]),
    notes: z.string().optional(),
  }),
});

// Update order item validation
export const updateOrderItemSchema = z.object({
  body: z.object({
    adjustedQuantity: z.number().positive('Miqdor musbat son bo\'lishi kerak'),
    adjustmentReason: z.string().min(5, 'Sabab kamida 5 ta belgidan iborat bo\'lishi kerak'),
  }),
});