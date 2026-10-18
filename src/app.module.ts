import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { HealthController } from './health.controller';
import { ProvenanceModule } from './provenance/provenance.module';
import { SemanticModule } from './semantic/semantic.module';
import { QueryEngineModule } from './query-engine/query-engine.module';
import { GenerationModule } from './generation/generation.module';
import { ImportsModule } from './imports/imports.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { MembersModule} from './members/members.module';
import { validateEnv } from './config/env';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    SupabaseModule,
    QueryEngineModule,
    ProvenanceModule,
    GenerationModule,
    ImportsModule,
    SemanticModule,
    OrganizationsModule,
    MembersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}