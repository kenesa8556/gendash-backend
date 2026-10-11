import { Injectable } from '@nestjs/common';
import { QueryEngineService } from '../query-engine/query-engine.service';

export interface OrgContext {
  currency: string;
  values: { branch: string[]; category: string[]; item: string[] };
}

const TTL_MS = 5 * 60_000;

@Injectable()
export class OrgContextService {
  private cache = new Map<string, { exp: number; ctx: OrgContext }>();
  constructor(private engine: QueryEngineService) {}

  private async top(orgId: string, col: 'branch' | 'category' | 'item', n: number) {
    const rows = await this.engine.raw(
      `select ${col} as v from sales where org_id = $1 and ${col} is not null
       group by 1 order by sum(amount) desc limit ${n}`,
      [orgId],
    );
    return rows.map((r) => String(r.v));
  }

  async get(orgId: string): Promise<OrgContext> {
    const hit = this.cache.get(orgId);
    if (hit && hit.exp > Date.now()) return hit.ctx;
    const [org, branch, category, item] = await Promise.all([
      this.engine.raw('select currency from organizations where id = $1', [orgId]),
      this.top(orgId, 'branch', 50),
      this.top(orgId, 'category', 50),
      this.top(orgId, 'item', 50),
    ]);
    const ctx: OrgContext = {
      currency: String(org[0]?.currency ?? 'ETB'),
      values: { branch, category, item },
    };
    this.cache.set(orgId, { exp: Date.now() + TTL_MS, ctx });
    return ctx;
  }

  invalidate(orgId: string) {
    this.cache.delete(orgId);
  }
}