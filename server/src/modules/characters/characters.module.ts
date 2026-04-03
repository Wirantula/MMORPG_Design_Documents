import { Module } from '@nestjs/common';
import { WheelService } from './wheels/wheel.service';
import { BirthService } from './birth/birth.service';
import { BirthController } from './birth/birth.controller';
@Module({
  controllers: [BirthController],
  providers: [WheelService, BirthService],
  exports: [WheelService, BirthService],
})
export class CharactersModule {}
