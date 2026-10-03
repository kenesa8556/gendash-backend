import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { PlannerModule } from '../planner/planner.module';
import { QueryEngineModule } from '../query-engine/query-engine.module';
import { ProvenanceModule } from '../provenance/provenance.module';

@Module({
  imports: [PlannerModule, QueryEngineModule, ProvenanceModule],
  controllers: [GenerationController],
})
export class GenerationModule {}