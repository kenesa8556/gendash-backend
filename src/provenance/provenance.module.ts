import { Module } from '@nestjs/common';
import { ProvenanceService } from './provenance.service';
import { QueriesController } from './queries.controller';

@Module({
  providers: [ProvenanceService],
  controllers: [QueriesController],
  exports: [ProvenanceService],
})
export class ProvenanceModule {}