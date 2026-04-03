import { Controller, Get, Post, Body, Param, HttpException, HttpStatus } from '@nestjs/common';
import { CurrencyService } from './currency.service';

interface TransferBody {
  fromId: string;
  toId: string;
  currencyId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
}

@Controller()
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get('characters/:id/wallet')
  getWallet(@Param('id') characterId: string) {
    const entries = this.currencyService.getWallet(characterId);
    return { characterId, wallet: entries };
  }

  @Post('wallet/transfer')
  transfer(@Body() body: TransferBody) {
    try {
      const tx = this.currencyService.transfer({
        fromId: body.fromId,
        toId: body.toId,
        currencyId: body.currencyId,
        amount: body.amount,
        reason: body.reason,
        idempotencyKey: body.idempotencyKey,
      });
      return tx;
    } catch (err) {
      throw new HttpException(
        (err as Error).message,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
