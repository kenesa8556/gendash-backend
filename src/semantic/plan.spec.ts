import { PanelSchema } from './plan';

describe('PanelSchema', () => {
  const ok = (p: unknown) => PanelSchema.safeParse(p).success;

  it('accepts normal plans', () => {
    expect(ok({ kind: 'bar', metrics: ['revenue'], dimension: 'branch' })).toBe(true);
    expect(ok({ kind: 'line', metrics: ['revenue'], dimension: 'month', breakdown: 'branch' })).toBe(true);
    expect(ok({ kind: 'kpi', metrics: ['revenue'] })).toBe(true);
  });
  it('rejects metrics and dimensions that do not exist', () => {
    expect(ok({ kind: 'bar', metrics: ['profit'], dimension: 'branch' })).toBe(false);
    expect(ok({ kind: 'bar', metrics: ['revenue'], dimension: 'customer' })).toBe(false);
  });
  it('enforces the chart rules', () => {
    expect(ok({ kind: 'kpi', metrics: ['revenue'], dimension: 'branch' })).toBe(false);
    expect(ok({ kind: 'bar', metrics: ['revenue'] })).toBe(false);
    expect(ok({ kind: 'line', metrics: ['revenue'], dimension: 'branch' })).toBe(false);
  });
  it('enforces the breakdown rules', () => {
    expect(ok({ kind: 'bar', metrics: ['revenue', 'orders'], dimension: 'branch', breakdown: 'category' })).toBe(false);
    expect(ok({ kind: 'line', metrics: ['revenue'], dimension: 'month', breakdown: 'month' })).toBe(false);
    expect(ok({ kind: 'table', metrics: ['revenue'], dimension: 'branch', breakdown: 'category' })).toBe(false);
  });
});