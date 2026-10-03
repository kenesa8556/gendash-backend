import {
  CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(@Inject(SUPABASE) private sb: SupabaseClient) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException('missing token');

    const { data, error } = await this.sb.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('invalid token');

    const orgId = req.headers['x-org-id'];
    if (typeof orgId !== 'string') throw new ForbiddenException('x-org-id header required');

    const { data: m, error: e2 } = await this.sb
      .from('members').select('role')
      .eq('user_id', data.user.id).eq('org_id', orgId).maybeSingle();
    if (e2) throw new UnauthorizedException(e2.message);
    if (!m) throw new ForbiddenException('not a member of this organization');

    req.user = { id: data.user.id, email: data.user.email };
    req.orgId = orgId;
    req.role = m.role;
    return true;
  }
}