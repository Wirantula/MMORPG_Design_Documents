import { Controller, Get, Post, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MarketService } from './market.service';
import { SimulationService } from '../simulation/simulation.service';

interface CreateListingBody {
  sellerId: string;
  itemInstanceId: string;
  canonicalId: string;
  price: number;
  quantity: number;
  expiresAtGameDay?: number;
}

interface CreateOrderBody {
  buyerId: string;
  canonicalId: string;
  maxPrice: number;
  quantity: number;
}

@Controller('market')
export class MarketController {
  constructor(
    private readonly marketService: MarketService,
    private readonly simulationService: SimulationService,
  ) {}

  // Rate limit: 60 listings per hour per IP.
  @Throttle({ default: { ttl: 3_600_000, limit: 60 } })
  @Post('listings')
  createListing(@Body() body: CreateListingBody) {
    try {
      const currentGameDay = this.simulationService.getGameDayNumber();
      return this.marketService.createListing({
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

  @Post('orders')
  createOrder(@Body() body: CreateOrderBody) {
    try {
      const currentGameDay = this.simulationService.getGameDayNumber();
      return this.marketService.createOrder({
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

  @Get('listings')
  getListings(@Query('canonical_id') canonicalId?: string) {
    const listings = this.marketService.getActiveListings(canonicalId);
    const priceHistory = canonicalId
      ? this.marketService.getPriceHistory(canonicalId)
      : [];
    return { listings, priceHistory };
  }
}
