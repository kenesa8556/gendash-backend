import { Injectable } from '@nestjs/common';
import { ProvenanceService } from '../provenance/provenance.service';

@Injectable()
export class UsageService {
  private counts = new Map<string, { day: string; n: number }>();
  constructor(private prov: ProvenanceService) {}

  async check(orgId: string, limit: number): Promise<boolean> {
    const day = new Date().toISOString().slice(0, 10);
    let c = this.counts.get(orgId);
    if (!c || c.day !== day) {
      c = { day, n: await this.prov.countToday(orgId) };
      this.counts.set(orgId, c);
    }
    return c.n < limit;
  }

  record(orgId: string) {
    const c = this.counts.get(orgId);
    if (c) c.n++;
  }
}