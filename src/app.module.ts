import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { HealthController } from './health.controller';
import { ProvenanceModule } from './provenance/provenance.module';
import { SemanticModule } from './semantic/semantic.module';
import { QueryEngineModule } from './query-engine/query-engine.module';
import { GenerationModule } from './generation/generation.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), 
    SupabaseModule,
    QueryEngineModule,
    ProvenanceModule,
    GenerationModule,
    SemanticModule
  ],
  controllers: [HealthController],
})
export class AppModule {}