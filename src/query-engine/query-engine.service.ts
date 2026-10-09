// src/query-engine/query-engine.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { METRICS, DIMENSIONS } from '../semantic/semantic';
import { Panel } from '../semantic/plan';


@Injectable()
export class QueryEngineService {
  private pool: Pool;

  constructor(cfg: ConfigService) {
    this.pool = new Pool({
      connectionString: cfg.getOrThrow('DATABASE_URL'),
      ssl: { rejectUnauthorized: false },
      statement_timeout: 5000,
      max: 5,
    });
  }

  // "Now" for the demo = newest sale date, so results never change with the calendar
     private anchors = new Map<string, Date>();

  async getAnchor(orgId: string): Promise<Date> {
    let a = this.anchors.get(orgId);
    if (!a) {
      const r = await this.pool.query(
        `select to_char(max(sold_at),'YYYY-MM-DD') as d from sales where org_id = $1`,
        [orgId],
      );
      a = r.rows[0].d ? new Date(r.rows[0].d + 'T00:00:00Z') : new Date();
      this.anchors.set(orgId, a);
    }
    return a;
  }

  build(orgId: string, panel: Panel, anchor: Date) {
    const params: unknown[] = [orgId];
    const where = ['org_id = $1'];

    for (const f of panel.filters) {
      params.push(f.value);
      const col = DIMENSIONS[f.dimension].sql;
      where.push(
        f.op === 'in' ? `${col} = any($${params.length})` : `${col} = $${params.length}`,
      );
    }

    if (panel.timeRange) {
      const start =
        panel.timeRange.unit === 'month'
          ? new Date(
              Date.UTC(
                anchor.getUTCFullYear(),
                anchor.getUTCMonth() - (panel.timeRange.last - 1),
                1,
              ),
            )
          : new Date(anchor.getTime() - panel.timeRange.last * 86400000);
      params.push(start.toISOString().slice(0, 10));
      where.push(`sold_at >= $${params.length}`);
    }

    const metricSql =
                     panel.metrics.map((m) => `${METRICS[m].sql} as ${m}`).join(', ') +
                (panel.dimension ? '' : ', count(*) as _rows'); // lets us detect "no matching rows" for KPIs
    const dim = panel.dimension ? DIMENSIONS[panel.dimension].sql : null;
    const brk = panel.breakdown ? DIMENSIONS[panel.breakdown].sql : null;
    const first = panel.metrics[0];

    let sql = `select ${dim ? `${dim} as dim, ` : ''}${brk ? `${brk} as series, ` : ''}${metricSql} from sales where ${where.join(' and ')}`;
    if (dim) {
      const groupBy = brk ? 'group by 1, 2' : 'group by 1';
      const orderBy =
        panel.dimension === 'month' ? (brk ? '1 asc, 2 asc' : '1 asc') : `${first} desc`;
      sql += ` ${groupBy} order by ${orderBy} limit ${brk ? 50 : panel.limit}`;
    }
    return { sql, params };
  }

  async run(orgId: string, panel: Panel) {
      const anchor = await this.getAnchor(orgId);
      const { sql, params } = this.build(orgId, panel, anchor);
      const res = await this.pool.query(sql, params);
      // an aggregate with no GROUP BY always returns one row, even when nothing matched
      const raw = panel.dimension
        ? res.rows
        : res.rows.filter((r) => Number(r._rows) > 0).map(({ _rows, ...rest }) => rest);
      const rows = raw.map((r) => {
        const out: Record<string, unknown> = { ...r };
        for (const m of panel.metrics) out[m] = Number(r[m]);
        return out;
      });
      return { sql, params, rowCount: rows.length, rows };
  }
}