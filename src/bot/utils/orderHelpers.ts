// Status tarjimalari
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Kutilmoqda',
  CONFIRMED: 'Tasdiqlangan',
  DELIVERED: 'Yetkazilgan',
  CANCELLED: 'Bekor qilingan',
};

export const STATUS_EMOJI: Record<string, string> = {
  DRAFT: '⏳',
  CONFIRMED: '✅',
  DELIVERED: '📦',
  CANCELLED: '❌',
};

export function translateStatus(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function getStatusEmoji(status: string): string {
  return STATUS_EMOJI[status] || '📋';
}

// Sana formatlash: "15-mart 2026"
export function formatDate(date: Date): string {
  const months = [
    'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
    'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
  ];
  return `${date.getDate()}-${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Buyurtma raqami: #N
export function formatOrderNumber(seq: number): string {
  return `#${seq}`;
}

// Bugungi sana (UTC+5 Toshkent)
export function getTodayDate(): Date {
  const now = new Date();
  const tashkentOffset = 5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const tashkent = new Date(utc + tashkentOffset * 60000);
  return new Date(tashkent.getFullYear(), tashkent.getMonth(), tashkent.getDate());
}

// Sana tugmalari uchun (bugun, ertaga, indinga)
export function getDateOptions(): { label: string; date: Date }[] {
  const today = getTodayDate();
  return [
    { label: '📅 Bugun', date: today },
    { label: '📅 Ertaga', date: new Date(today.getTime() + 86400000) },
    { label: '📅 Indinga', date: new Date(today.getTime() + 86400000 * 2) },
  ];
}

// Narxni formatlash: "45 000 so'm"
export function formatPrice(price: number | string | any): string {
  const num = Number(price);
  return `${num.toLocaleString('uz-UZ')} so'm`;
}

// totalAmount hisoblash
export function calcTotal(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}
