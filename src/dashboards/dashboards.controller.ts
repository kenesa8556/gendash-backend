import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Org } from '../auth/org.decorator';
import { DashboardsService } from './dashboards.service';

@Controller('dashboards')
@UseGuards(SupabaseAuthGuard)
export class DashboardsController {
  constructor(private svc: DashboardsService) {}

  @Post()
  create(@Org() orgId: string, @Req() req: any, @Body() body: { runId?: string; title?: string }) {
    if (!body?.runId || !/^[0-9a-f-]{36}$/i.test(body.runId))
      throw new BadRequestException('runId required');
    return this.svc.create(orgId, req.user.id, body.runId, body.title);
  }

  @Get()
  list(@Org() orgId: string) {
    return this.svc.list(orgId);
  }

  @Get(':id')
  get(@Org() orgId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.get(orgId, id);
  }

  @Delete(':id')
  remove(@Org() orgId: string, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.svc.remove(orgId, id);
  }
}