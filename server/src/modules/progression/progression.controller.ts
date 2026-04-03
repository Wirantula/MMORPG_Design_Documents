import { Controller, Get } from '@nestjs/common';
import { XpService } from './xp.service';

@Controller('api/admin/balance')
export class ProgressionController {
  constructor(private readonly xpService: XpService) {}

  @Get('xp-curves')
  getXpCurves() {
    return this.xpService.getCurveData();
  }
}
