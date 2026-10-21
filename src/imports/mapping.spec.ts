import { suggestMapping } from './mapping';
import { readCsv } from './csv';

describe('suggestMapping', () => {
  it('matches common English headers', () =>
    expect(suggestMapping(['Date', 'Branch', 'Category', 'Item', 'Qty', 'Amount'])).toEqual({
      date: 0, amount: 5, qty: 4, branch: 1, category: 2, item: 3,
    }));
  it('matches different words for the same things', () =>
    expect(suggestMapping(['Day', 'Store', 'Type', 'Product', 'Quantity', 'Price'])).toEqual({
      date: 0, amount: 5, qty: 4, branch: 1, category: 2, item: 3,
    }));
  it('matches headers with extra words', () => {
    const m = suggestMapping(['Sale Date', 'Total Price']);
    expect(m.date).toBe(0);
    expect(m.amount).toBe(1);
  });
  it('leaves unknown columns unmatched', () => {
    const m = suggestMapping(['When', 'Cash']);
    expect(m.date).toBeNull();
    expect(m.amount).toBeNull();
  });
});

describe('readCsv', () => {
  it('detects semicolons and quoted fields', () => {
    const r = readCsv(Buffer.from('Day;Store\n03/09/2026;"Bole, Main"\n'));
    expect(r.headers).toEqual(['Day', 'Store']);
    expect(r.rows).toEqual([['03/09/2026', 'Bole, Main']]);
  });
  it('ignores a byte-order mark and blank lines', () => {
    const r = readCsv(Buffer.from('\uFEFFDate,Amount\n\n2026-09-03,100\n'));
    expect(r.headers).toEqual(['Date', 'Amount']);
    expect(r.rows).toEqual([['2026-09-03', '100']]);
  });
});