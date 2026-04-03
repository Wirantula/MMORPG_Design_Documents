import { Module } from '@nestjs/common';
import { WheelService } from './wheels/wheel.service';
import { BirthService } from './birth/birth.service';
import { BirthController } from './birth/birth.controller';
import { StatService } from './stats/stat.service';
import { StatController, AdminStatController } from './stats/stat.controller';

@Module({
  controllers: [BirthController, StatController, AdminStatController],
  providers: [WheelService, BirthService, StatService],
  exports: [WheelService, BirthService, StatService],
})
export class CharactersModule {}
