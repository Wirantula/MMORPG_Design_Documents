import { Module } from '@nestjs/common';
import { WheelService } from './wheels/wheel.service';
import { BirthService } from './birth/birth.service';
import { BirthController } from './birth/birth.controller';
import { CharactersService } from './characters.service';
import { CharactersController, AdminCharactersController } from './characters.controller';
import { StatService } from './stats/stat.service';
import { StatController, AdminStatController } from './stats/stat.controller';

@Module({
  controllers: [
    BirthController,
    CharactersController,
    AdminCharactersController,
    StatController,
    AdminStatController,
  ],
  providers: [WheelService, BirthService, CharactersService, StatService],
  exports: [WheelService, BirthService, CharactersService, StatService],
})
export class CharactersModule {}
