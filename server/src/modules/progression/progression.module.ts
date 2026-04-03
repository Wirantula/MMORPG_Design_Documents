import { Module } from '@nestjs/common';
import { XpService } from './xp.service';
import { ProgressionController } from './progression.controller';

@Module({
  providers: [XpService],
  controllers: [ProgressionController],
  exports: [XpService],
})
export class ProgressionModule {}
