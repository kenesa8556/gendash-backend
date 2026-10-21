import { SpecBuilderService } from './spec-builder.service';

describe('SpecBuilderService', () => {
  const sb = new SpecBuilderService();
  const month = { kind: 'line', metrics: ['revenue'], dimension: 'month', filters: [], limit: 12 } as any;
  const branch = { kind: 'bar', metrics: ['revenue'], dimension: 'branch', filters: [], limit: 12 } as any;
  const rows = (dims: string[]) => dims.map((dim) => ({ dim, revenue: 987654321 }));

  it('flags an incomplete latest month', () => {
    const sp = sb.build('p1', month, rows(['2026-08', '2026-09']), new Date('2026-09-27T00:00:00Z'), 'ETB');
    expect(sp.partialLastPeriod).toBe(true);
    expect(sb.build('p1', month, rows(['2026-08', '2026-09']), new Date('2026-09-30T00:00:00Z'), 'ETB').partialLastPeriod).toBe(false);
  });

  it('shows an empty state instead of a chart when there are no rows', () =>
    expect(sb.build('p1', branch, [], new Date(), 'ETB').state).toBe('empty'));

  it('turns a one-point line chart into a table', () => {
    const sp = sb.build('p1', month, rows(['2026-09']), new Date('2026-09-27T00:00:00Z'), 'ETB');
    expect(sp.kind).toBe('table');
    expect(sp.state).toBe('fallback');
  });

  it('turns a bar chart with too many categories into a table', () => {
    const many = Array.from({ length: 16 }, (_, i) => `c${i}`);
    expect(sb.build('p1', branch, rows(many), new Date(), 'ETB').kind).toBe('table');
  });

  it('states the metric and the currency in the label', () =>
    expect(sb.build('p1', branch, rows(['Bole']), new Date(), 'USD').label).toContain('Revenue (USD) by Branch'));

  it('never carries row data inside the spec', () => {
    const sp = sb.build('p1', branch, rows(['Bole']), new Date(), 'ETB');
    expect(JSON.stringify(sp)).not.toContain('987654321');
    expect(Object.keys(sp)).not.toContain('rows');
  });
});