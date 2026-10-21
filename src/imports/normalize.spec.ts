import { detectDateOrder, parseAmount, parseDate, validateRows } from './normalize';

describe('parseDate', () => {
  it('reads ISO dates', () => expect(parseDate('2026-09-03', 'dmy')).toBe('2026-09-03'));
  it('reads day-first and month-first', () => {
    expect(parseDate('03/09/2026', 'dmy')).toBe('2026-09-03');
    expect(parseDate('03/09/2026', 'mdy')).toBe('2026-03-09');
  });
  it('reads two-digit years', () => expect(parseDate('03/09/26', 'dmy')).toBe('2026-09-03'));
  it('reads Excel serial numbers', () => expect(parseDate('46268', 'dmy')).toBe('2026-09-03'));
  it('rejects impossible or empty dates', () => {
    expect(parseDate('31/02/2026', 'dmy')).toBeNull();
    expect(parseDate('hello', 'dmy')).toBeNull();
    expect(parseDate('', 'dmy')).toBeNull();
  });
});

describe('parseAmount', () => {
  it('handles currency text and thousands separators', () => {
    expect(parseAmount('3,500 ETB')).toBe(3500);
    expect(parseAmount('1,234.56')).toBe(1234.56);
    expect(parseAmount('1.234,56')).toBe(1234.56);
    expect(parseAmount('2 600,00')).toBe(2600);
  });
  it('reads negatives and rejects text', () => {
    expect(parseAmount('(500)')).toBe(-500);
    expect(parseAmount('-12')).toBe(-12);
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
});

describe('detectDateOrder', () => {
  it('detects day-first from a day above 12', () =>
    expect(detectDateOrder(['13/09/2026', '03/09/2026'])).toEqual({ order: 'dmy', ambiguous: false }));
  it('detects month-first', () =>
    expect(detectDateOrder(['09/13/2026'])).toEqual({ order: 'mdy', ambiguous: false }));
  it('reports ambiguity when it cannot tell', () =>
    expect(detectDateOrder(['03/09/2026'])).toEqual({ order: 'dmy', ambiguous: true }));
  it('is never ambiguous for ISO dates', () =>
    expect(detectDateOrder(['2026-09-03']).ambiguous).toBe(false));
});

describe('validateRows', () => {
  const rows = [
    ['2026-09-03', '3,500 ETB', 'Bole'],
    ['', '100', 'Bole'],
    ['2026-09-04', 'abc', 'Bole'],
    ['Total', '3600', ''],
    ['2026-09-05', '-5', 'Bole'],
    ['', '', ''],
  ];
  const res = validateRows(rows, { date: 0, amount: 1, branch: 2 } as any, 'dmy');

  it('keeps good rows and fills missing optional fields', () => {
    expect(res.valid).toEqual([
      { branch: 'Bole', category: 'Unknown', item: 'Unknown', qty: 1, amount: 3500, sold_at: '2026-09-03' },
    ]);
  });
  it('skips bad rows with the right reasons and ignores blank rows silently', () => {
    expect(res.skipped).toBe(4);
    expect(res.reasons).toEqual({
      'missing or unreadable date': 1,
      'missing or unreadable amount': 1,
      'looks like a total row': 1,
      'negative amount': 1,
    });
  });
});