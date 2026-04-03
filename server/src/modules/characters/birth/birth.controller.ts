import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BirthService } from './birth.service';
import type { WheelType } from '../wheels/wheel.types';

interface StartRitualBody {
  accountId: string;
}

interface SpinWheelBody {
  characterId: string;
}

interface CompleteRitualBody {
  characterId: string;
}

@Controller('characters/birth')
export class BirthController {
  constructor(private readonly birthService: BirthService) {}

  @Post('start')
  startRitual(@Body() body: StartRitualBody) {
    try {
      return this.birthService.startRitual(body.accountId);
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('spin/:wheel')
  spinWheel(
    @Param('wheel') wheel: string,
    @Body() body: SpinWheelBody,
  ) {
    try {
      return this.birthService.spinWheel(
        body.characterId,
        wheel as WheelType,
      );
    } catch (err) {
      const message = (err as Error).message;
      const status = message.includes('cooldown')
        ? HttpStatus.TOO_MANY_REQUESTS
        : HttpStatus.BAD_REQUEST;
      throw new HttpException(message, status);
    }
  }

  @Post('complete')
  completeRitual(@Body() body: CompleteRitualBody) {
    try {
      return this.birthService.completeRitual(body.characterId);
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('ritual/:characterId')
  getRitual(@Param('characterId') characterId: string) {
    const ritual = this.birthService.getRitual(characterId);
    if (!ritual) {
      throw new HttpException('Ritual not found', HttpStatus.NOT_FOUND);
    }
    return ritual;
  }
}
