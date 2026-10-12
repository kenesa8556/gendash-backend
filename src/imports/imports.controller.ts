import {
  Body, Controller, Delete, ForbiddenException, Get, Param, ParseUUIDPipe, Post, Req,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { Org } from '../auth/org.decorator';
import { ImportsService, MAX_FILE_BYTES } from './imports.service';

const upload = FileInterceptor('file', { limits: { fileSize: MAX_FILE_BYTES, files: 1 } });
const ownerOnly = (req: any) => {
  if (req.role !== 'owner') throw new ForbiddenException('Only owners can manage data.');
};

@Controller('imports')
@UseGuards(SupabaseAuthGuard)
export class ImportsController {
  constructor(private svc: ImportsService) {}

  @Post('preview')
  @UseInterceptors(upload)
  preview(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    ownerOnly(req);
    return this.svc.preview(file);
  }

  @Post()
  @UseInterceptors(upload)
  create(@Org() orgId: string, @Req() req: any, @UploadedFile() file: Express.Multer.File, @Body() body: any) {
    ownerOnly(req);
    return this.svc.run(orgId, req.user.id, file, body ?? {});
  }

  @Get()
  list(@Org() orgId: string) {
    return this.svc.list(orgId);
  }

  @Delete(':id')
  remove(@Org() orgId: string, @Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    ownerOnly(req);
    return this.svc.remove(orgId, id);
  }
}