import { Mapping } from './mapping';

export interface SalesRow {
  branch: string; category: string; item: string; qty: number; amount: number; sold_at: string;
}
type Order = 'dmy' | 'mdy';
const pad = (n: number) => String(n).padStart(2, '0');

function build(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseDate(raw: string, order: Order): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s.*)?$/.exec(s);
  if (m) {
    const a = +m[1], b = +m[2];
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    return order === 'dmy' ? build(y, b, a) : build(y, a, b);
  }
  if (/^\d{5}$/.test(s)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000); // Excel serial date
    return build(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return null;
}

export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,\-()]/g, '');
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  const dot = s.lastIndexOf('.');
  const comma = s.lastIndexOf(',');
  if (dot >= 0 && comma >= 0) {
    s = dot > comma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (comma >= 0) {
    s = /,\d{3}(,\d{3})*$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }
  const n = Number(s);
  if (!s || !Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export function detectDateOrder(values: string[]): { order: Order; ambiguous: boolean } {
  let dmy = false, mdy = false, seen = false;
  for (const v of values) {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(v.trim());
    if (!m) continue;
    seen = true;
    if (+m[1] > 12) dmy = true;
    if (+m[2] > 12) mdy = true;
  }
  if (dmy && !mdy) return { order: 'dmy', ambiguous: false };
  if (mdy && !dmy) return { order: 'mdy', ambiguous: false };
  return { order: 'dmy', ambiguous: seen };
}

const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);

export function validateRows(rows: string[][], m: Mapping, order: Order) {
  const valid: SalesRow[] = [];
  const issues: { line: number; reason: string }[] = [];
  const reasons: Record<string, number> = {};
  const skip = (i: number, reason: string) => {
    reasons[reason] = (reasons[reason] ?? 0) + 1;
    if (issues.length < 30) issues.push({ line: i + 2, reason }); // +2: header is line 1
  };

  rows.forEach((r, i) => {
    const cell = (c?: number | null) => (c == null ? '' : String(r[c] ?? '').trim());
    if (r.every((x) => !String(x ?? '').trim())) return;

    if ([m.date, m.branch, m.category, m.item].map(cell).some((t) => /^(grand\s*|sub\s*)?total\b/i.test(t)))
      return skip(i, 'looks like a total row');

    const sold_at = parseDate(cell(m.date), order);
    if (!sold_at) return skip(i, 'missing or unreadable date');

    const amount = parseAmount(cell(m.amount));
    if (amount === null) return skip(i, 'missing or unreadable amount');
    if (amount < 0) return skip(i, 'negative amount');
    if (amount > 1e9) return skip(i, 'amount too large');

    let qty = 1;
    const qs = cell(m.qty);
    if (qs) {
      const n = Number(qs.replace(/,/g, ''));
      if (!Number.isFinite(n) || n <= 0) return skip(i, 'unreadable or zero quantity');
      qty = Math.max(1, Math.round(n));
    }

    valid.push({
      branch: clean(cell(m.branch)) || 'Unknown',
      category: clean(cell(m.category)) || 'Unknown',
      item: clean(cell(m.item)) || 'Unknown',
      qty, amount, sold_at,
    });
  });

  const dates = valid.map((v) => v.sold_at).sort();
  return {
    valid, issues, reasons,
    skipped: Object.values(reasons).reduce((a, b) => a + b, 0),
    dateRange: dates.length ? { from: dates[0], to: dates[dates.length - 1] } : null,
  };
}