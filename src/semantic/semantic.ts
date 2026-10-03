export const METRICS = {
  revenue: { label: 'Revenue (ETB)', sql: 'sum(amount)', format: 'currency' },
  orders:  { label: 'Orders',        sql: 'count(*)',    format: 'number' },
  units:   { label: 'Units sold',    sql: 'sum(qty)',    format: 'number' },
} as const;

export const DIMENSIONS = {
  month:    { label: 'Month',    sql: "to_char(date_trunc('month', sold_at), 'YYYY-MM')" },
  branch:   { label: 'Branch',   sql: 'branch' },
  category: { label: 'Category', sql: 'category' },
  item:     { label: 'Item',     sql: 'item' },
} as const;

export type MetricKey = keyof typeof METRICS;
export type DimensionKey = keyof typeof DIMENSIONS;
export const METRIC_KEYS = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];
export const DIMENSION_KEYS = Object.keys(DIMENSIONS) as [DimensionKey, ...DimensionKey[]];