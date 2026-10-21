import { QueryEngineService } from './query-engine.service';
jest.mock('@nestjs/config', () => ({ ConfigService: class ConfigService {} }));

describe('QueryEngineService.build', () => {
  const svc = new QueryEngineService({ getOrThrow: () => 'postgresql://u:p@localhost:5432/db' } as any);
  const anchor = new Date('2026-09-27T00:00:00Z');
  const base = { kind: 'bar', metrics: ['revenue'], dimension: 'branch', filters: [], limit: 12 } as any;

  it('always scopes the query to the organization', () => {
    const { sql, params } = svc.build('ORG-1', base, anchor);
    expect(sql).toContain('org_id = $1');
    expect(params[0]).toBe('ORG-1');
  });

  it('never puts user-supplied values into the SQL text', () => {
    const evil = "Dresses'; drop table sales; --";
    const { sql, params } = svc.build('ORG-1', { ...base, filters: [{ dimension: 'category', op: 'eq', value: evil }] }, anchor);
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain(evil);
    expect(params).toContain(evil);
  });

  it('counts calendar months back from the newest sale, not from today', () => {
    const { params } = svc.build('ORG-1', { ...base, timeRange: { last: 6, unit: 'month' } }, anchor);
    expect(params).toContain('2026-04-01');
  });

  it('counts days back from the newest sale', () => {
    const { params } = svc.build('ORG-1', { ...base, timeRange: { last: 10, unit: 'day' } }, anchor);
    expect(params).toContain('2026-09-17');
  });

  it('adds a series column and double grouping for a breakdown', () => {
    const { sql } = svc.build('ORG-1', { ...base, kind: 'line', dimension: 'month', breakdown: 'branch' }, anchor);
    expect(sql).toContain('as series');
    expect(sql).toContain('group by 1, 2');
  });
});