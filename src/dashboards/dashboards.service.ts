import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';
import { Plan } from '../semantic/plan';

@Injectable()
export class DashboardsService {
  constructor(@Inject(SUPABASE) private sb: SupabaseClient) {}

  async create(orgId: string, userId: string, runId: string, title?: string) {
    const { data: run, error } = await this.sb
      .from('generation_runs').select('id, plan, spec')
      .eq('id', runId).eq('org_id', orgId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!run) throw new NotFoundException('run not found');

    const { data, error: e2 } = await this.sb.from('dashboards').insert({
      org_id: orgId,
      created_by: userId,
      run_id: run.id,
      title: (title?.trim() || (run.spec as any).title).slice(0, 80),
      plan: run.plan,
      spec: run.spec,
    }).select('id, title, version').single();
    if (e2) throw new Error(e2.message);
    return data;
  }

  async list(orgId: string) {
    const { data, error } = await this.sb.from('dashboards')
      .select('id, title, version, updated_at')
      .eq('org_id', orgId).order('updated_at', { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data;
  }

  private async row(orgId: string, id: string) {
    const { data, error } = await this.sb.from('dashboards')
      .select('id, title, plan, spec, run_id, version')
      .eq('id', id).eq('org_id', orgId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('dashboard not found');
    return data;
  }

  async get(orgId: string, id: string) {
    const d = await this.row(orgId, id);
    const data: Record<string, unknown[]> = {};
    if (d.run_id) {
      const { data: qs, error } = await this.sb.from('query_log')
        .select('id, rows').eq('run_id', d.run_id).eq('org_id', orgId);
      if (error) throw new Error(error.message);
      for (const q of qs ?? []) data[q.id] = q.rows as unknown[];
    }
    return { id: d.id, title: d.title, version: d.version, spec: d.spec, data };
  }

  async getPlan(orgId: string, id: string): Promise<{ plan: Plan; version: number }> {
    const d = await this.row(orgId, id);
    return { plan: d.plan as Plan, version: d.version };
  }

  async applyRun(orgId: string, id: string, runId: string, plan: unknown, spec: unknown, version: number) {
    const { error } = await this.sb.from('dashboards').update({
      plan, spec, run_id: runId, version: version + 1, updated_at: new Date().toISOString(),
    }).eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
  }

  async remove(orgId: string, id: string) {
    const { error, count } = await this.sb.from('dashboards')
      .delete({ count: 'exact' }).eq('id', id).eq('org_id', orgId);
    if (error) throw new Error(error.message);
    if (!count) throw new NotFoundException('dashboard not found');
    return { deleted: true };
  }
}