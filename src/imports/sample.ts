import type { SalesRow } from './normalize';

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATALOG = [
  { category: 'Dresses', item: 'Habesha Kemis', price: 3500 },
  { category: 'Dresses', item: 'Summer Dress', price: 1800 },
  { category: 'Shirts', item: 'Cotton Shirt', price: 900 },
  { category: 'Shirts', item: 'Polo', price: 750 },
  { category: 'Shoes', item: 'Leather Shoes', price: 2600 },
  { category: 'Accessories', item: 'Scarf', price: 450 },
];

// 180 days of made-up sales ending today, so the sample always looks current
export function sampleRows(): SalesRow[] {
  const rand = mulberry32(7);
  const pick = <T>(a: T[]) => a[Math.floor(rand() * a.length)];
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  const rows: SalesRow[] = [];
  for (let d = 179; d >= 0; d--) {
    const sold_at = new Date(end.getTime() - d * 86_400_000).toISOString().slice(0, 10);
    const n = 6 + Math.floor(rand() * 8);
    for (let i = 0; i < n; i++) {
      const p = pick(CATALOG);
      const qty = 1 + Math.floor(rand() * 3);
      const boost = 1 + ((179 - d) / 179) * (p.category === 'Dresses' ? 0.5 : 0);
      rows.push({
        branch: rand() < 0.6 ? 'Main Branch' : 'City Branch',
        category: p.category, item: p.item, qty,
        amount: Math.round(p.price * qty * boost), sold_at,
      });
    }
  }
  return rows;
}