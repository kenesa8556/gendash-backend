import { Module } from '@nestjs/common';
import { SemanticController } from './semantic.controller';
@Module({
  controllers: [SemanticController],
})
export class SemanticModule {}