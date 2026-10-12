import { z } from 'zod';

export const MappingSchema = z.object({
  date: z.number().int().min(0),
  amount: z.number().int().min(0),
  branch: z.number().int().min(0).nullish(),
  category: z.number().int().min(0).nullish(),
  item: z.number().int().min(0).nullish(),
  qty: z.number().int().min(0).nullish(),
});
export type Mapping = z.infer<typeof MappingSchema>;

const SYNONYMS = {
  date: ['date', 'day', 'sold at', 'sale date', 'order date', 'transaction date'],
  amount: ['amount', 'total', 'revenue', 'sales', 'price', 'value', 'total price', 'line total', 'birr', 'etb'],
  qty: ['qty', 'quantity', 'units', 'count', 'pieces'],
  branch: ['branch', 'shop', 'store', 'location', 'outlet'],
  category: ['category', 'type', 'group', 'department'],
  item: ['item', 'product', 'product name', 'description', 'name', 'sku'],
} as const;

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function suggestMapping(headers: string[]) {
  const heads = headers.map(norm);
  const used = new Set<number>();
  const out: Record<string, number | null> = {};
  for (const field of ['date', 'amount', 'qty', 'branch', 'category', 'item'] as const) {
    const syn: readonly string[] = SYNONYMS[field];
    let idx = heads.findIndex((h, i) => !used.has(i) && syn.includes(h));
    if (idx < 0)
      idx = heads.findIndex((h, i) => !used.has(i) && syn.some((s) => ` ${h} `.includes(` ${s} `)));
    out[field] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  return out as Record<'date' | 'amount' | 'qty' | 'branch' | 'category' | 'item', number | null>;
}