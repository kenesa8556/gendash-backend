import {
  Body, Controller, Delete, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseUserGuard } from '../auth/supabase-user.guard';
import { Org } from '../auth/org.decorator';
import { MembersService } from './members.service';

const ownerOnly = (req: any) => {
  if (req.role !== 'owner') throw new ForbiddenException('Only owners can do this.');
};

@Controller()
export class MembersController {
  constructor(private svc: MembersService) {}

  @Get('members') @UseGuards(SupabaseAuthGuard)
  list(@Org() orgId: string) { return this.svc.listMembers(orgId); }

  @Get('invitations') @UseGuards(SupabaseAuthGuard)
  listInvitations(@Org() orgId: string, @Req() req: any) { ownerOnly(req); return this.svc.listInvitations(orgId); }

  @Post('invitations') @UseGuards(SupabaseAuthGuard)
  invite(@Org() orgId: string, @Req() req: any, @Body() body: { email?: string; role?: string }) {
    ownerOnly(req);
    return this.svc.invite(orgId, req.user, body);
  }

  @Delete('invitations/:id') @UseGuards(SupabaseAuthGuard)
  revoke(@Org() orgId: string, @Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    ownerOnly(req);
    return this.svc.revoke(orgId, id);
  }

  @Put('members/:userId') @UseGuards(SupabaseAuthGuard)
  setRole(@Org() orgId: string, @Req() req: any, @Param('userId', new ParseUUIDPipe()) userId: string,
          @Body() body: { role?: string }) {
    ownerOnly(req);
    return this.svc.setRole(orgId, userId, String(body?.role ?? ''));
  }

  @Delete('members/:userId') @UseGuards(SupabaseAuthGuard)
  remove(@Org() orgId: string, @Req() req: any, @Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.svc.remove(orgId, userId, { id: req.user.id, role: req.role });
  }

  // user-level: no organization needed, only a valid sign-in
  @Post('invitations/:id/respond') @UseGuards(SupabaseUserGuard)
  respond(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: { accept?: boolean }) {
    return this.svc.respond(req.user, id, body?.accept === true);
  }
}