import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';

@Injectable()
export class ProvenanceService {
  constructor(@Inject(SUPABASE) private sb: SupabaseClient) {}

    async countToday(orgId: string): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { count, error } = await this.sb
      .from('generation_runs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .gte('created_at', start.toISOString());
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  async save(p: {
    runId: string; orgId: string; prompt: string; plan: unknown; spec: unknown;
    model: string; attempts: number; latencyMs: number;
    queries: { id: string; panelId: string; sql: string; params: unknown[]; rows: unknown[] }[];
  }) {
    // supabase-js does not throw: always check the error object
    const { error: e1 } = await this.sb.from('generation_runs').insert({
      id: p.runId, org_id: p.orgId, prompt: p.prompt, plan: p.plan, spec: p.spec,
      model: p.model, attempts: p.attempts, latency_ms: p.latencyMs,
    });
    if (e1) throw new Error(`save run failed: ${e1.message}`);

    const { error: e2 } = await this.sb.from('query_log').insert(
      p.queries.map((q) => ({
        id: q.id, run_id: p.runId, org_id: p.orgId, panel_id: q.panelId,
        sql_text: q.sql, params: q.params, row_count: q.rows.length, rows: q.rows,
      })),
    );
    if (e2) throw new Error(`save queries failed: ${e2.message}`);
  }

  async getQuery(orgId: string, id: string) {
    const { data, error } = await this.sb
      .from('query_log')
      .select('id, panel_id, sql_text, params, row_count, rows, executed_at')
      .eq('id', id)
      .eq('org_id', orgId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('query not found');
    // never show internal ids to the reader
    const params = (data.params as unknown[]).map((v, i) => (i === 0 ? '<your organization>' : v));
    return { ...data, params };
  }
}