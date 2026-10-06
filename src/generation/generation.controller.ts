import {
  BadRequestException, Body, Controller, HttpException, HttpStatus, Post, Res, UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PlannerService } from '../planner/planner.service';
import { QueryEngineService } from '../query-engine/query-engine.service';
import { SpecBuilderService } from '../spec-builder/spec-builder.service';
import { ProvenanceService } from '../provenance/provenance.service';
import { DashboardsService } from '../dashboards/dashboards.service';
import { Plan } from '../semantic/plan';
import { SPEC_VERSION, SpecPanel } from '../semantic/spec';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Org } from '../auth/org.decorator';

type Q = { id: string; panelId: string; sql: string; params: unknown[]; rows: unknown[] };
const UUID = /^[0-9a-f-]{36}$/i;

@Controller()
@UseGuards(SupabaseAuthGuard)
export class GenerationController {
  constructor(
    private planner: PlannerService,
    private engine: QueryEngineService,
    private specBuilder: SpecBuilderService,
    private prov: ProvenanceService,
    private dashboards: DashboardsService,
    private cfg: ConfigService,
  ) {}

  @Post('generate')
  async generate(
    @Org() orgId: string,
    @Body() body: { question?: string; dashboardId?: string },
    @Res() res: Response,
  ) {
    const question = body?.question;
    if (!question || typeof question !== 'string' || question.length > 300)
      throw new BadRequestException('question required, max 300 chars');

    let aborted = false;
    res.on('close', () => {
      if (!res.writableEnded) aborted = true; // client cancelled / disconnected
    });

    const limit = Number(this.cfg.get('DAILY_GENERATION_LIMIT') ?? 50);
    if ((await this.prov.countToday(orgId)) >= limit)
      throw new HttpException(
        'Daily generation limit reached for this organization.',
        HttpStatus.TOO_MANY_REQUESTS,
      );

    // refine mode: load the saved plan (404 here, before the stream starts)
    let previous: { plan: Plan; version: number } | undefined;
    if (body.dashboardId) {
      if (!UUID.test(body.dashboardId)) throw new BadRequestException('invalid dashboardId');
      previous = await this.dashboards.getPlan(orgId, body.dashboardId);
    }
    if (aborted) return;

    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const send = (event: string, data: unknown) => {
      if (!aborted) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    const t0 = Date.now();
    const runId = randomUUID();
    try {
      send('status', { stage: 'planning' });
      const { plan, attempts } = await this.planner.plan(question, previous?.plan);
      if (aborted) return;
      send('plan', { runId, title: plan.title, panelCount: plan.panels.length });

      const anchor = await this.engine.getAnchor(orgId);
      const panels: SpecPanel[] = [];
      const queries: Q[] = [];
      await Promise.all(
        plan.panels.map(async (p, i) => {
          const r = await this.engine.run(orgId, p);
          const sp = this.specBuilder.build(`p${i + 1}`, p, r.rows, anchor);
          panels.push(sp);
          queries.push({ id: sp.queryId, panelId: sp.id, sql: r.sql, params: r.params, rows: r.rows });
          send('panel', { panel: sp, rows: r.rows });
        }),
      );
      if (aborted) return;

      panels.sort((a, b) => a.id.localeCompare(b.id));
      const latencyMs = Date.now() - t0;
      send('done', { runId, attempts, latencyMs });

      // saved AFTER the user already sees the full dashboard
      try {
        const spec = { specVersion: SPEC_VERSION, title: plan.title, panels };
        await this.prov.save({
          runId, orgId, prompt: question, plan, spec,
          model: this.cfg.get('GEMINI_MODEL') ?? '', attempts, latencyMs, queries,
        });
        if (body.dashboardId && previous) {
          await this.dashboards.applyRun(orgId, body.dashboardId, runId, plan, spec, previous.version);
        }
      } catch (e) {
        console.error('provenance/dashboard save failed', e);
        send('warning', { message: 'Dashboard is shown, but its data trail could not be saved.' });
      }
    } catch (e) {
      console.error('generate failed', e);
      send('error', { message: 'Could not build the dashboard. Please try again.' });
    } finally {
      if (!res.writableEnded) res.end();
    }
  }
}