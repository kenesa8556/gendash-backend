import { Controller, Get, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from './supabase/supabase.module';

@Controller('health')
export class HealthController {
  constructor(@Inject(SUPABASE) private sb: SupabaseClient) {}

  @Get()
  async check() {
    const { error } = await this.sb.from('organizations').select('id').limit(1);
    return { ok: !error, db: error ? error.message : 'connected' };
  }
}