import { PrismaClient, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

// Xabarnoma yaratish helper funksiyasi
export const createNotification = async (data: NotificationData) => {
  try {
    const notification = await prisma.notification.create({
      data,
    });
    return notification;
  } catch (error) {
    console.error('Notification yaratishda xato:', error);
    return null;
  }
};

// Ko'p foydalanuvchilarga xabarnoma yuborish
export const createBulkNotifications = async (
  userIds: string[],
  notificationData: Omit<NotificationData, 'userId'>
) => {
  try {
    const notifications = userIds.map((userId) => ({
      userId,
      ...notificationData,
    }));

    const result = await prisma.notification.createMany({
      data: notifications,
    });

    return result;
  } catch (error) {
    console.error('Bulk notification yaratishda xato:', error);
    return null;
  }
};

// Buyurtma holati o'zgarganda xabarnoma
export const notifyOrderStatusChange = async (
  orderId: string,
  distributorId: string,
  oldStatus: string,
  newStatus: string,
  orderNumber: string
) => {
  return createNotification({
    userId: distributorId,
    type: 'ORDER_STATUS',
    title: 'Buyurtma holati o\'zgartirildi',
    message: `Buyurtma ${orderNumber} holati ${oldStatus} dan ${newStatus} ga o'zgartirildi`,
    relatedEntityType: 'order',
    relatedEntityId: orderId,
  });
};

// Barcha distributor'larga xabarnoma yuborish
export const notifyAllDistributors = async (
  title: string,
  message: string,
  type: NotificationType = 'SYSTEM'
) => {
  const distributors = await prisma.user.findMany({
    where: {
      role: 'DISTRIBUTOR',
      isActive: true,
    },
    select: { id: true },
  });

  const userIds = distributors.map((d) => d.id);

  return createBulkNotifications(userIds, {
    type,
    title,
    message,
  });
};