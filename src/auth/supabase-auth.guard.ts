import {
  CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable,
  ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';

const TTL_MS = 60_000;
type Hit = { userId: string; email?: string; role: string; exp: number };

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private cache = new Map<string, Hit>();
  constructor(@Inject(SUPABASE) private sb: SupabaseClient) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException('missing token');
    const orgId = req.headers['x-org-id'];
    if (typeof orgId !== 'string') throw new ForbiddenException('x-org-id header required');

    const key = `${token}|${orgId}`;
    const hit = this.cache.get(key);
    if (hit && hit.exp > Date.now()) {
      req.user = { id: hit.userId, email: hit.email };
      req.orgId = orgId;
      req.role = hit.role;
      return true;
    }

    let res = await this.sb.auth.getUser(token);
    if (res.error && (!res.error.status || res.error.status >= 500)) {
      res = await this.sb.auth.getUser(token); // one retry on network/server errors
    }
    const { data, error } = res;
    if (error || !data.user) {
      console.error('auth.getUser failed:', error?.status, error?.message);
      const transient = !!error && (!error.status || error.status >= 500);
      if (transient) throw new ServiceUnavailableException('Auth service unreachable, please try again.');
      throw new UnauthorizedException('invalid token');
    }

    const { data: m, error: e2 } = await this.sb
      .from('members').select('role')
      .eq('user_id', data.user.id).eq('org_id', orgId).maybeSingle();
    if (e2) {
      console.error('membership check failed:', e2.message);
      throw new ServiceUnavailableException('Could not verify membership, please try again.');
    }
    if (!m) throw new ForbiddenException('not a member of this organization');

    if (this.cache.size > 500) {
      const now = Date.now();
      for (const [k, v] of this.cache) if (v.exp <= now) this.cache.delete(k);
    }
    this.cache.set(key, { userId: data.user.id, email: data.user.email, role: m.role, exp: Date.now() + TTL_MS });

    req.user = { id: data.user.id, email: data.user.email };
    req.orgId = orgId;
    req.role = m.role;
    return true;
  }
}