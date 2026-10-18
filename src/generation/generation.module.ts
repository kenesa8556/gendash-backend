import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { PlannerModule } from '../planner/planner.module';
import { QueryEngineModule } from '../query-engine/query-engine.module';
import { ProvenanceModule } from '../provenance/provenance.module';
import { UsageService } from "./usage.service"
import { DashboardsModule } from '../dashboards/dashboards.module';
import { RateLimitService } from './rate-limit.service';

@Module({
  imports: [PlannerModule, QueryEngineModule, ProvenanceModule, DashboardsModule],
  controllers: [GenerationController],
  providers : [UsageService, RateLimitService]
})
export class GenerationModule {}