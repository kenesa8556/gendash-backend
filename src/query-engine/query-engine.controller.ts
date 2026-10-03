import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PanelSchema } from '../semantic/plan';
import { SPEC_VERSION, SpecPanel } from '../semantic/spec';
import { QueryEngineService } from './query-engine.service';
import { PlannerService } from '../planner/planner.service';
import { SpecBuilderService } from '../spec-builder/spec-builder.service';
import { ProvenanceService } from '../provenance/provenance.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Org } from '../auth/org.decorator';

@Controller('dev')
@UseGuards(SupabaseAuthGuard)
export class QueryEngineController {
  constructor(
    private engine: QueryEngineService,
    private planner: PlannerService,
    private specBuilder: SpecBuilderService,
    private prov: ProvenanceService,
    private cfg: ConfigService,
  ) {}

  @Post('query')
  async query(@Org() orgId: string, @Body() body: unknown) {
    const parsed = PanelSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.engine.run(orgId, parsed.data);
  }

  @Post('ask')
  async ask(@Org() orgId: string, @Body() body: { question?: string }) {
    if (!body?.question || body.question.length > 300)
      throw new BadRequestException('question required, max 300 chars');

    const t0 = Date.now();
    const runId = randomUUID();

    // 1. Plan (Gemini)
    const tPlan = Date.now();
    const { plan, attempts } = await this.planner.plan(body.question);
    const planMs = Date.now() - tPlan;

    // 2. Run all panels in parallel, build their specs
    const tQ = Date.now();
    const anchor = await this.engine.getAnchor(orgId);
    const built = await Promise.all(
      plan.panels.map(async (p, i) => {
        const r = await this.engine.run(orgId, p);
        const sp = this.specBuilder.build(`p${i + 1}`, p, r.rows, anchor);
        return { sp, r };
      }),
    );
    const queryMs = Date.now() - tQ;

    const panels: SpecPanel[] = [];
    const data: Record<string, unknown[]> = {};
    const queries: {
      id: string;
      panelId: string;
      sql: string;
      params: unknown[];
      rows: unknown[];
    }[] = [];
    for (const { sp, r } of built) {
      panels.push(sp);
      data[sp.queryId] = r.rows;
      queries.push({ id: sp.queryId, panelId: sp.id, sql: r.sql, params: r.params, rows: r.rows });
    }

    // 3. Save provenance
    const spec = { specVersion: SPEC_VERSION, title: plan.title, panels };
    const latencyMs = Date.now() - t0;
    await this.prov.save({
      runId,
      orgId,
      prompt: body.question,
      plan,
      spec,
      model: this.cfg.get('GEMINI_MODEL') ?? '',
      attempts,
      latencyMs,
      queries,
    });

    const timings = { planMs, queryMs, totalMs: Date.now() - t0 };
    console.log('timings', timings);
    return { runId, attempts, latencyMs, timings, spec, data };
  }
}