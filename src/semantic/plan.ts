import { z } from 'zod';
import { METRIC_KEYS, DIMENSION_KEYS } from './semantic';

export const PanelSchema = z.object({
  kind: z.enum(['kpi', 'line', 'bar', 'table']),
  metrics: z.array(z.enum(METRIC_KEYS)).min(1).max(3),
  dimension: z.enum(DIMENSION_KEYS).optional(),
  breakdown: z.enum(DIMENSION_KEYS).optional(),
  filters: z.array(z.object({
    dimension: z.enum(DIMENSION_KEYS),
    op: z.enum(['eq', 'in']),
    value: z.union([z.string(), z.array(z.string()).max(20)]),
  })).max(5).default([]),
  timeRange: z.object({
    last: z.number().int().min(1).max(36),
    unit: z.enum(['day', 'month']),
  }).optional(),
  limit: z.number().int().min(1).max(50).default(12),
}).superRefine((p, ctx) => {
  if (p.kind === 'kpi' && p.dimension)
    ctx.addIssue({ code: 'custom', message: 'kpi cannot have a dimension' });
  if (p.kind !== 'kpi' && !p.dimension)
    ctx.addIssue({ code: 'custom', message: `${p.kind} needs a dimension` });
  if (p.kind === 'line' && p.dimension !== 'month')
    ctx.addIssue({ code: 'custom', message: 'line charts must use month' });
  if (p.breakdown) {
    if (p.kind !== 'line' && p.kind !== 'bar')
      ctx.addIssue({ code: 'custom', message: 'breakdown only for line/bar' });
    if (p.metrics.length !== 1)
      ctx.addIssue({ code: 'custom', message: 'breakdown needs exactly one metric' });
    if (p.breakdown === p.dimension || p.breakdown === 'month')
      ctx.addIssue({ code: 'custom', message: 'invalid breakdown dimension' });
  }
});
export type Panel = z.infer<typeof PanelSchema>;
export const PlanSchema = z.object({
  title: z.string().min(1).max(80),
  panels: z.array(PanelSchema).min(1).max(6),
});
export type Plan = z.infer<typeof PlanSchema>;