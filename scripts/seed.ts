import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const ORG_ID = process.env.SEED_ORG_ID!;
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

const catalog = [
  { category: 'Dresses', item: 'Habesha Kemis', price: 3500 },
  { category: 'Dresses', item: 'Summer Dress', price: 1800 },
  { category: 'Shirts', item: 'Cotton Shirt', price: 900 },
  { category: 'Shirts', item: 'Polo', price: 750 },
  { category: 'Shoes', item: 'Leather Shoes', price: 2600 },
  { category: 'Accessories', item: 'Scarf', price: 450 },
];

const rows: any[] = [];
const start = new Date('2026-04-01');
for (let d = 0; d < 180; d++) {
  const day = new Date(start.getTime() + d * 86400000);
  const n = 8 + Math.floor(rand() * 10);
  for (let i = 0; i < n; i++) {
    const p = pick(catalog);
    const qty = 1 + Math.floor(rand() * 3);
    const boost = 1 + (d / 180) * (p.category === 'Dresses' ? 0.5 : 0);
    rows.push({
      org_id: ORG_ID,
      branch: rand() < 0.58 ? 'Bole' : 'Piassa',
      category: p.category,
      item: p.item,
      qty,
      amount: Math.round(p.price * qty * boost),
      sold_at: day.toISOString().slice(0, 10),
    });
  }
}

(async () => {
  const { error: delErr } = await sb.from('sales').delete().eq('org_id', ORG_ID);
  if (delErr) throw delErr;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('sales').insert(rows.slice(i, i + 500));
    if (error) throw error;
    console.log(`inserted ${Math.min(i + 500, rows.length)}/${rows.length}`);
  }
})();