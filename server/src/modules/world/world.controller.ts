import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { WorldService } from './world.service';
import type { WorldNodeType } from './world.service';

@Controller('world')
export class WorldController {
  constructor(private readonly worldService: WorldService) {}

  @Get('nodes')
  getNodes(@Query('type') type?: string) {
    if (type) {
      const validTypes: WorldNodeType[] = [
        'universe', 'planet', 'plane', 'region', 'settlement_zone',
      ];
      if (!validTypes.includes(type as WorldNodeType)) {
        throw new HttpException(
          `Invalid node type: ${type}. Valid types: ${validTypes.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }
      return this.worldService.getNodesByType(type as WorldNodeType);
    }
    return this.worldService.getAllNodes();
  }

  @Get('nodes/:id/connections')
  getConnections(@Param('id') id: string) {
    const node = this.worldService.getNodeById(id);
    if (!node) {
      throw new HttpException(
        `Node ${id} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    const edges = this.worldService.getConnections(id);
    return { node, edges };
  }
}
