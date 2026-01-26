// Bot xabarlari uchun constants

export const MESSAGES = {
  WELCOME: (name: string) => `Assalomu alaykum, ${name}! 👋

🥩 Real Taste of Meat - Buyurtmalar botiga xush kelibsiz!

Bu bot orqali siz:
✅ Buyurtma berishingiz
✅ Buyurtmalaringizni kuzatishingiz
✅ Xabarnomalar olishingiz mumkin`,

  REGISTRATION_PENDING: `✋ Sizning hisobingiz hali tasdiqlanmagan.

Admin tomonidan tasdiqlanganidan keyin botdan foydalanishingiz mumkin bo'ladi.

📞 Aloqa: +998 XX XXX XX XX`,

  INACTIVE_USER: `⚠️ Sizning hisobingiz faol emas.

Botdan foydalanish uchun admin bilan bog'laning.

📞 Aloqa: +998 XX XXX XX XX`,

  HELP: `❓ Yordam

📞 Aloqa:
Tel: +998 XX XXX XX XX
Email: info@realtaste.uz

⏰ Buyurtma vaqti: 04:00 - 16:00

📝 Bot buyruqlari:
/start - Botni qayta boshlash
/menu - Asosiy menyu
/help - Yordam

Savollaringiz bo'lsa, biz bilan bog'laning!`,

  UNAUTHORIZED: `🚫 Sizda bu amalni bajarish uchun ruxsat yo'q.`,

  ERROR: `❌ Xatolik yuz berdi. Iltimos, qayta urinib ko'ring.`,
};

import TelegramBot from 'node-telegram-bot-api';

export const getMainKeyboard = (role: string): TelegramBot.ReplyKeyboardMarkup => {
  if (role === 'DISTRIBUTOR') {
    return {
      keyboard: [
        [{ text: '📦 Yangi buyurtma' }, { text: '📋 Mening buyurtmalarim' }],
        [{ text: '🔔 Xabarnomalar' }, { text: '👤 Profil' }],
        [{ text: '❓ Yordam' }],
      ],
      resize_keyboard: true,
    };
  } else if (role === 'PRODUCER' || role === 'ADMIN') {
    return {
      keyboard: [
        [{ text: '📊 Buyurtmalar' }, { text: '📈 Hisobotlar' }],
        [{ text: '👥 Foydalanuvchilar' }, { text: '🔔 Xabarnomalar' }],  // <-- Yangi qator
        [{ text: '👤 Profil' }, { text: '❓ Yordam' }],
      ],
      resize_keyboard: true,
    };
  }

  return {
    keyboard: [[{ text: '❓ Yordam' }]],
    resize_keyboard: true,
  };
};