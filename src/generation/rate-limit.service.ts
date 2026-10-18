import { Injectable } from '@nestjs/common';

@Injectable()
export class RateLimitService {
  private hits = new Map<string, number[]>();

  allow(key: string, max: number, windowMs = 60_000): boolean {
    const now = Date.now();
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    if (this.hits.size > 5000)
      for (const [k, v] of this.hits) if (!v.some((t) => now - t < windowMs)) this.hits.delete(k);
    return true;
  }
}