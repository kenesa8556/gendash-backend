import { BadRequestException, Body, Controller, HttpException, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PlannerService } from '../planner/planner.service';
import { QueryEngineService } from '../query-engine/query-engine.service';
import { SpecBuilderService } from '../spec-builder/spec-builder.service';
import { ProvenanceService } from '../provenance/provenance.service';
import { SPEC_VERSION, SpecPanel } from '../semantic/spec';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Org } from '../auth/org.decorator';
import { UsageService } from "./usage.service"


type Q = { id: string; panelId: string; sql: string; params: unknown[]; rows: unknown[] };

@Controller()
@UseGuards(SupabaseAuthGuard)
export class GenerationController {
  constructor(
    private planner: PlannerService,
    private engine: QueryEngineService,
    private specBuilder: SpecBuilderService,
    private prov: ProvenanceService,
    private cfg: ConfigService,
    private usage: UsageService
  ) {}

  @Post('generate')
  async generate(
    @Org() orgId: string,
    @Body() body: { question?: string },
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
    if (!(await this.usage.check(orgId, limit)))
      throw new HttpException(
        'Daily generation limit reached for this organization.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
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
      const { plan, attempts } = await this.planner.plan(question);
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
          send('panel', { panel: sp, rows: r.rows }); // each panel streams as soon as it is ready
        }),
      );
      if (aborted) return;

      panels.sort((a, b) => a.id.localeCompare(b.id));
      const latencyMs = Date.now() - t0;
      send('done', { runId, attempts, latencyMs });

      // provenance is saved AFTER the user already sees the full dashboard
      try {
        await this.prov.save({
          runId, orgId, prompt: question, plan,
          spec: { specVersion: SPEC_VERSION, title: plan.title, panels },
          model: this.cfg.get('GEMINI_MODEL') ?? '', attempts, latencyMs, queries,
        });this.usage.record(orgId);
      } catch (e) {
        console.error('provenance save failed', e);
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