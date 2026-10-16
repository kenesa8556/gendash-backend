import * as ExcelJS from 'exceljs';

export class XlsxError extends Error {}

const MAX_ROWS = 50_000;
const MAX_COLS = 60;

// Reads cell VALUES only. Formulas are never evaluated: we use the result Excel stored in the file.
function text(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'string') return v.trim();
  const o = v as any;
  if (o.result !== undefined) return text(o.result);
  if (o.richText) return o.richText.map((r: any) => r.text).join('').trim();
  if (o.text !== undefined) return String(o.text).trim();
  return '';
}

function findTable(ws: ExcelJS.Worksheet): { headers: string[]; rows: string[][] } | null {
  if (ws.rowCount > MAX_ROWS + 50) throw new XlsxError(`This sheet has too many rows (max ${MAX_ROWS}).`);
  const cols = Math.min(ws.columnCount, MAX_COLS);
  if (cols < 2) return null;
  const grid: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cells: string[] = [];
    for (let c = 1; c <= cols; c++) cells.push(text(row.getCell(c).value));
    grid.push(cells);
  }
  // the header is the first row (within the first 20) that has at least two filled cells
  const h = grid.slice(0, 20).findIndex((r) => r.filter((x) => x !== '').length >= 2);
  if (h < 0) return null;
  let width = grid[h].length;
  while (width > 0 && grid[h][width - 1] === '') width--;
  const headers = grid[h].slice(0, width).map((x, i) => x || `Column ${i + 1}`);
  const rows = grid.slice(h + 1).map((r) => r.slice(0, width)).filter((r) => r.some((x) => x !== ''));
  return rows.length ? { headers, rows } : null;
}

export async function readXlsx(buf: Buffer, sheetName?: string) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf as any);
  } catch {
    throw new XlsxError('Could not read this Excel file. Make sure it is a normal .xlsx workbook.');
  }
  const visible = wb.worksheets.filter((w) => w.state === 'visible');
  if (!visible.length) throw new XlsxError('This workbook has no visible sheets.');

  if (sheetName) {
    const ws = visible.find((w) => w.name === sheetName);
    if (!ws) throw new XlsxError('That sheet does not exist.');
    const t = findTable(ws);
    if (!t) throw new XlsxError('No table with data found on this sheet.');
    return { ...t, sheets: visible.map((w) => w.name), sheet: ws.name };
  }
  // no sheet chosen: use the first sheet that actually contains a table
  for (const ws of visible) {
    const t = findTable(ws);
    if (t) return { ...t, sheets: visible.map((w) => w.name), sheet: ws.name };
  }
  throw new XlsxError('No table with data found in this workbook.');
}