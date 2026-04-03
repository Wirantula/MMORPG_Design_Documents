import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { SimulationService } from '../../simulation/simulation.service';
import type { ContractType } from '../economy.types';

interface CreateContractBody {
  type: ContractType;
  offererId: string;
  termsJson: Record<string, unknown>;
  escrowAmount: number;
  deadlineGameDay: number;
}

interface AcceptContractBody {
  acceptorId: string;
}

interface BreachContractBody {
  breachedById: string;
}

@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly simulationService: SimulationService,
  ) {}

  @Post()
  create(@Body() body: CreateContractBody) {
    try {
      const currentGameDay = this.simulationService.getGameDayNumber();
      return this.contractsService.createContract({
        ...body,
        currentGameDay,
      });
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    const contract = this.contractsService.getContract(id);
    if (!contract) {
      throw new HttpException('Contract not found', HttpStatus.NOT_FOUND);
    }
    return contract;
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string, @Body() body: AcceptContractBody) {
    try {
      return this.contractsService.acceptContract(id, body.acceptorId);
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch(':id/complete')
  complete(@Param('id') id: string) {
    try {
      return this.contractsService.completeContract(id);
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch(':id/breach')
  breach(@Param('id') id: string, @Body() body: BreachContractBody) {
    try {
      return this.contractsService.breachContract(id, body.breachedById);
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
