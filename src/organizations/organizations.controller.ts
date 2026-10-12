import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SupabaseUserGuard } from '../auth/supabase-user.guard';
import { OrganizationsService } from './organizations.service';

@Controller()
@UseGuards(SupabaseUserGuard)
export class OrganizationsController {
  constructor(private svc: OrganizationsService) {}

  @Get('me')
  me(@Req() req: any) {
    return this.svc.me(req.user);
  }

  @Post('organizations')
  create(@Req() req: any, @Body() body: { name?: string; currency?: string }) {
    return this.svc.create(req.user, body);
  }
}