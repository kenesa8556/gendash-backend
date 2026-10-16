import * as ExcelJS from 'exceljs';
import { mkdirSync } from 'fs';

const d = (iso: string) => new Date(iso + 'T00:00:00Z');

async function main() {
  mkdirSync('evals/fixtures', { recursive: true });

  // 1. clean: real Excel dates and numbers, one sheet
  const a = new ExcelJS.Workbook();
  const s = a.addWorksheet('Sales');
  s.addRow(['Date', 'Branch', 'Category', 'Item', 'Qty', 'Amount']);
  s.addRow([d('2026-09-01'), 'Bole', 'Dresses', 'Habesha Kemis', 1, 3500]);
  s.addRow([d('2026-09-01'), 'Bole', 'Shirts', 'Polo', 2, 1500]);
  s.addRow([d('2026-09-02'), 'Piassa', 'Shoes', 'Leather Shoes', 1, 2600]);
  s.addRow([d('2026-09-02'), 'Piassa', 'Dresses', 'Summer Dress', 1, 1800]);
  s.addRow([d('2026-09-03'), 'Bole', 'Accessories', 'Scarf', 3, 1350]);
  s.getColumn(1).numFmt = 'yyyy-mm-dd';
  await a.xlsx.writeFile('evals/fixtures/clean.xlsx');

  // 2. messy: a notes sheet first, title rows above the header, text amount, formula, total row
  const b = new ExcelJS.Workbook();
  b.addWorksheet('Notes').addRow(['This sheet is not the sales table']);
  const m = b.addWorksheet('Sales Sept');
  m.addRow(['My Shop sales report']);
  m.addRow([]);
  m.addRow(['Day', 'Store', 'Type', 'Product', 'Quantity', 'Price']);
  m.addRow([d('2026-09-03'), 'Bole', 'Dresses', 'Habesha Kemis', 1, '3,500 ETB']);
  m.addRow([d('2026-09-04'), 'Bole', 'Shirts', 'Polo', 2, { formula: '1500', result: 1500 }]);
  m.addRow([d('2026-09-13'), 'Piassa', 'Shoes', 'Leather Shoes', null, 2600]);
  m.addRow([null, 'Piassa', 'Shoes', 'Leather Shoes', 1, 2600]);
  m.addRow([d('2026-09-05'), 'Piassa', 'Scarf', 'Scarf', 1, 'abc']);
  m.addRow(['Total', null, null, null, null, { formula: 'SUM(F4:F8)', result: 7600 }]);
  m.getColumn(1).numFmt = 'dd/mm/yyyy';
  await b.xlsx.writeFile('evals/fixtures/messy.xlsx');
  console.log('created evals/fixtures/clean.xlsx and messy.xlsx');
}
main();