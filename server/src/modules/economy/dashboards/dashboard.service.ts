import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type EconomyExportCompleted,
} from '../../../common/domain-events';
import { MarketService } from '../market.service';
import { ContractsService } from '../contracts/contracts.service';
import type {
  TradeSummaryItem,
  SinkReport,
  FaucetReport,
  ShortageAlert,
  InflationAlert,
} from '../economy.types';

import * as fs from 'fs';
import * as path from 'path';

const SHORTAGE_THRESHOLD_DAYS = 3;
const INFLATION_THRESHOLD_PERCENT = 50;
const INFLATION_OBSERVATION_DAYS = 7;

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  // Track faucet emissions (rewards/NPC) — populated externally or via events
  private faucetRewards = 0;
  private faucetNpcPurchases = 0;

  constructor(
    private readonly eventBus: DomainEventBus,
    private readonly marketService: MarketService,
    private readonly contractsService: ContractsService,
  ) {}

  // ── Summary ───────────────────────────────────────────────────

  getSummary(): TradeSummaryItem[] {
    const allHistory = this.marketService.getAllPriceHistory();
    const summaries: TradeSummaryItem[] = [];

    for (const [canonicalId, entries] of allHistory.entries()) {
      if (entries.length === 0) continue;

      const totalVolume = entries.reduce((sum, e) => sum + e.quantity, 0);
      const totalValue = entries.reduce((sum, e) => sum + e.price * e.quantity, 0);
      const avgPrice = totalValue / totalVolume;

      // Price velocity: compare first and last entry price
      const oldest = entries[0];
      const newest = entries[entries.length - 1];
      const priceVelocity =
        oldest.price > 0
          ? ((newest.price - oldest.price) / oldest.price) * 100
          : 0;

      summaries.push({ canonicalId, totalVolume, totalValue, avgPrice, priceVelocity });
    }

    // Sort by total value descending (top traded items)
    summaries.sort((a, b) => b.totalValue - a.totalValue);
    return summaries;
  }

  // ── Sinks ─────────────────────────────────────────────────────

  getSinks(currentGameDay: number): SinkReport {
    return {
      gameDay: currentGameDay,
      totalFees: this.marketService.getTotalFeesCollected(),
      totalEscrowLost: 0, // TODO: track escrow lost to breaches separately
    };
  }

  // ── Faucets ───────────────────────────────────────────────────

  getFaucets(currentGameDay: number): FaucetReport {
    return {
      gameDay: currentGameDay,
      totalRewards: this.faucetRewards,
      totalNpcPurchases: this.faucetNpcPurchases,
    };
  }

  recordFaucetReward(amount: number): void {
    this.faucetRewards += amount;
  }

  recordFaucetNpcPurchase(amount: number): void {
    this.faucetNpcPurchases += amount;
  }

  // ── Shortage detection ────────────────────────────────────────

  detectShortages(currentGameDay: number): ShortageAlert[] {
    const alerts: ShortageAlert[] = [];
    const allHistory = this.marketService.getAllPriceHistory();

    // Check every canonical ID that ever had a trade
    for (const [canonicalId, entries] of allHistory.entries()) {
      const activeListings = this.marketService.getActiveListings(canonicalId);
      if (activeListings.length > 0) continue;

      // Find the most recent trade day
      const lastTradeDay =
        entries.length > 0
          ? entries[entries.length - 1].tradedAtGameDay
          : 0;

      const daysSince = currentGameDay - lastTradeDay;
      if (daysSince >= SHORTAGE_THRESHOLD_DAYS) {
        alerts.push({ canonicalId, daysSinceLastListing: daysSince });
      }
    }

    return alerts;
  }

  // ── Inflation detection ───────────────────────────────────────

  detectInflation(currentGameDay: number): InflationAlert[] {
    const alerts: InflationAlert[] = [];
    const allHistory = this.marketService.getAllPriceHistory();

    for (const [canonicalId, entries] of allHistory.entries()) {
      if (entries.length < 2) continue;

      // Find entries within observation window
      const windowStart = currentGameDay - INFLATION_OBSERVATION_DAYS;
      const recentEntries = entries.filter((e) => e.tradedAtGameDay >= windowStart);
      if (recentEntries.length < 2) continue;

      const oldPrice = recentEntries[0].price;
      const newPrice = recentEntries[recentEntries.length - 1].price;
      if (oldPrice <= 0) continue;

      const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;
      if (changePercent >= INFLATION_THRESHOLD_PERCENT) {
        alerts.push({
          canonicalId,
          priceChangePercent: Math.round(changePercent * 100) / 100,
          periodDays: INFLATION_OBSERVATION_DAYS,
        });
      }
    }

    return alerts;
  }

  // ── Export ─────────────────────────────────────────────────────

  exportReport(currentGameDay: number): string {
    const report = {
      exportedAt: new Date().toISOString(),
      gameDay: currentGameDay,
      summary: this.getSummary(),
      sinks: this.getSinks(currentGameDay),
      faucets: this.getFaucets(currentGameDay),
      shortages: this.detectShortages(currentGameDay),
      inflation: this.detectInflation(currentGameDay),
      activeListings: this.marketService.getActiveListings().length,
      activeContracts: this.contractsService.getActiveContractCount(),
    };

    const exportDir = path.resolve(process.cwd(), 'infra', 'exports');
    fs.mkdirSync(exportDir, { recursive: true });

    const fileName = `economy_report_day_${currentGameDay}_${Date.now()}.json`;
    const filePath = path.join(exportDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');

    const event: EconomyExportCompleted = {
      eventId: generateEventId(),
      type: 'EconomyExportCompleted',
      timestamp: new Date().toISOString(),
      payload: {
        filePath,
        rowCount: report.summary.length,
        gameDay: currentGameDay,
      },
    };
    this.eventBus.emit(event);

    this.logger.log(
      `Economy report exported: ${filePath} (${report.summary.length} items, day ${currentGameDay})`,
      'DashboardService',
    );

    return filePath;
  }
}
