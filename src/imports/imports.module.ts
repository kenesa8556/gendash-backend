import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { QueryEngineModule } from '../query-engine/query-engine.module';

@Module({
  imports: [QueryEngineModule],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}