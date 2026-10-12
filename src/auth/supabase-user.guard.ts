import {
  CanActivate, ExecutionContext, Inject, Injectable,
  ServiceUnavailableException, UnauthorizedException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.module';

@Injectable()
export class SupabaseUserGuard implements CanActivate {
  constructor(@Inject(SUPABASE) private sb: SupabaseClient) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const token = String(req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!token) throw new UnauthorizedException('missing token');

    let res = await this.sb.auth.getUser(token);
    if (res.error && (!res.error.status || res.error.status >= 500)) {
      res = await this.sb.auth.getUser(token);
    }
    const { data, error } = res;
    if (error || !data.user) {
      console.error('auth.getUser failed:', error?.status, error?.message);
      if (!!error && (!error.status || error.status >= 500))
        throw new ServiceUnavailableException('Auth service unreachable, please try again.');
      throw new UnauthorizedException('invalid token');
    }
    req.user = { id: data.user.id, email: (data.user.email ?? '').toLowerCase() };
    return true;
  }
}