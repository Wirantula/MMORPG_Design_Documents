import { Module } from '@nestjs/common';
import { WheelService } from './wheels/wheel.service';
import { BirthService } from './birth/birth.service';
import { BirthController } from './birth/birth.controller';
import { StatService } from './stats/stat.service';
import { StatController, AdminStatController } from './stats/stat.controller';
import { TraitService } from './traits/trait.service';
import { TraitController } from './traits/trait.controller';

@Module({
  controllers: [BirthController, StatController, AdminStatController, TraitController],
  providers: [WheelService, BirthService, StatService, TraitService],
  exports: [WheelService, BirthService, StatService, TraitService],
})
export class CharactersModule {}
