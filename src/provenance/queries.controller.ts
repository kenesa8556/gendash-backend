import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ProvenanceService } from './provenance.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Org } from '../auth/org.decorator';

@Controller('queries')
@UseGuards(SupabaseAuthGuard)
export class QueriesController {
  constructor(private prov: ProvenanceService) {}

  @Get(':id')
  get(@Org() orgId: string, @Param('id') id: string) {
    return this.prov.getQuery(orgId, id);
  }
}