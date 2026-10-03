import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE = 'SUPABASE';

@Global()
@Module({
  providers: [{
    provide: SUPABASE,
    inject: [ConfigService],
    useFactory: (c: ConfigService) =>
      createClient(c.getOrThrow('SUPABASE_URL'), c.getOrThrow('SUPABASE_SERVICE_KEY')),
  }],
  exports: [SUPABASE],
})
export class SupabaseModule {}