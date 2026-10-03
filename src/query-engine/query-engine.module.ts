import { Module } from '@nestjs/common';
import { QueryEngineService } from './query-engine.service';
import { QueryEngineController } from './query-engine.controller';
import { SpecBuilderService } from '../spec-builder/spec-builder.service';
import { PlannerModule } from '../planner/planner.module';
import { ProvenanceModule } from '../provenance/provenance.module';

@Module({
  imports: [PlannerModule, ProvenanceModule],
  providers: [QueryEngineService, SpecBuilderService],
  controllers: [QueryEngineController],
  exports: [QueryEngineService, SpecBuilderService],
})
export class QueryEngineModule {}