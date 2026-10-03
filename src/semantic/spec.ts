import { z } from 'zod';

export const SPEC_VERSION = 1;

export const SpecPanelSchema = z.object({
  id: z.string(),
  kind: z.enum(['kpi', 'line', 'bar', 'table']),
  label: z.string(),
  queryId: z.string(),
  format: z.enum(['currency', 'number']),
  state: z.enum(['ok', 'empty', 'fallback']),
  partialLastPeriod: z.boolean(),
  note: z.string().optional(),
});
export type SpecPanel = z.infer<typeof SpecPanelSchema>;