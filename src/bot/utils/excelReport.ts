import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

export interface ReportFilters {
  date?: Date;
  status?: string;
}

export async function generateOrdersExcel(filters: ReportFilters): Promise<string> {
  // Build where condition
  const whereCondition: any = {};

  if (filters.date) {
    const d = filters.date;
    const nextDay = new Date(d.getTime() + 86_400_000);
    whereCondition.orderDate = {
      gte: d,
      lt: nextDay,
    };
  }

  if (filters.status) {
    whereCondition.status = filters.status;
  }

  const orders = await prisma.order.findMany({
    where: whereCondition,
    include: {
      distributor: true,
      items: { include: { product: true } },
    },
    orderBy: { orderSeq: 'asc' },
  });

  // Collect all unique products across orders
  const productMap = new Map<string, string>(); // id -> "name (unit)"
  orders.forEach((order) => {
    order.items.forEach((item) => {
      productMap.set(
        item.product.id,
        `${item.product.name} (${item.product.unit})`
      );
    });
  });

  const productIds = Array.from(productMap.keys());
  const productNames = Array.from(productMap.values());

  // Create workbook
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Hisobot');

  // Header row
  const headerRow = sheet.addRow(['Mijoz', ...productNames, 'Jami (so\'m)']);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD3D3D3' },
  };

  // Column widths
  sheet.getColumn(1).width = 25;
  productIds.forEach((_, i) => {
    sheet.getColumn(i + 2).width = 18;
  });
  sheet.getColumn(productIds.length + 2).width = 15;

  // Data rows + column totals
  const columnTotals = new Array(productIds.length).fill(0);

  orders.forEach((order) => {
    const clientName =
      order.distributor.companyName || order.distributor.name;
    const rowData: (string | number)[] = [clientName];

    productIds.forEach((productId, i) => {
      const item = order.items.find((it) => it.productId === productId);
      if (item) {
        const qty = Number(item.quantity);
        columnTotals[i] += qty;
        rowData.push(qty);
      } else {
        rowData.push('');
      }
    });

    rowData.push(Number(order.totalAmount));
    sheet.addRow(rowData);
  });

  // Totals row
  const grandTotal = orders.reduce(
    (sum, o) => sum + Number(o.totalAmount),
    0
  );
  const totalsRow = sheet.addRow(['JAMI', ...columnTotals, grandTotal]);
  totalsRow.font = { bold: true };
  totalsRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFF0AA' },
  };

  // Save to temp file
  const tmpDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const filePath = path.join(tmpDir, `report-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}
