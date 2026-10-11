import { Module } from '@nestjs/common';
import { QueryEngineService } from './query-engine.service';
import { SpecBuilderService } from '../spec-builder/spec-builder.service';
import { OrgContextService } from '../organizations/org-context.service';

@Module({
  providers: [QueryEngineService, SpecBuilderService, OrgContextService],
  exports: [QueryEngineService, SpecBuilderService, OrgContextService],
})
export class QueryEngineModule {}