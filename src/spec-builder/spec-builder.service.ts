import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { METRICS, DIMENSIONS } from '../semantic/semantic';
import { Panel } from '../semantic/plan';
import { SpecPanel } from '../semantic/spec';

type Row = Record<string, unknown>;

@Injectable()
export class SpecBuilderService {
  label(p: Panel): string {
    let s = p.metrics.map((k) => METRICS[k].label).join(' & ');
    if (p.dimension) s += ` by ${DIMENSIONS[p.dimension].label}`;
    if (p.breakdown) s += ` and ${DIMENSIONS[p.breakdown].label}`;
    if (p.dimension && p.dimension !== 'month' && p.limit <= 5) s = `Top ${p.limit}: ${s}`;
    for (const f of p.filters) {
      const v = Array.isArray(f.value) ? f.value.join(', ') : f.value;
      s += ` · ${DIMENSIONS[f.dimension].label}: ${v}`;
    }
    if (p.timeRange) s += ` · last ${p.timeRange.last} ${p.timeRange.unit}s`;
    return s;
  }

  build(id: string, panel: Panel, rows: Row[], anchor: Date): SpecPanel {
    let kind = panel.kind;
    let state: SpecPanel['state'] = 'ok';
    let note: string | undefined;

    const distinctDims = new Set(rows.map((r) => r.dim)).size;

    if (rows.length === 0) {
      state = 'empty';
      note = 'No data matches this question.';
    } else if (kind === 'line' && distinctDims < 2) {
      kind = 'table';
      state = 'fallback';
      note = 'Not enough points for a trend, shown as a table.';
    } else if (kind === 'bar' && distinctDims > 15) {
      kind = 'table';
      state = 'fallback';
      note = 'Too many categories for a bar chart, shown as a table.';
    }

    let partialLastPeriod = false;
    if (panel.dimension === 'month' && rows.length > 0) {
      const y = anchor.getUTCFullYear();
      const m = anchor.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      partialLastPeriod = anchor.getUTCDate() < lastDay && rows.some((r) => r.dim === key);
      if (partialLastPeriod) note = (note ? note + ' ' : '') + 'Latest month is incomplete.';
    }

    return {
      id,
      kind,
      label: this.label(panel),
      queryId: randomUUID(),
      format: METRICS[panel.metrics[0]].format,
      state,
      partialLastPeriod,
      note,
    };
  }
}