import { Module } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { CurrencyController } from './currency.controller';
import { DomainEventBus } from '../../common/domain-events';

@Module({
  controllers: [CurrencyController],
  providers: [CurrencyService, DomainEventBus],
  exports: [CurrencyService],
})
export class CurrencyModule {}
