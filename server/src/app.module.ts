import { Module } from '@nestjs/common';
import { SharedModule } from './modules/shared/shared.module';
import { HealthModule } from './modules/health/health.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { EconomyModule } from './modules/economy/economy.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { CharactersModule } from './modules/characters/characters.module';
import { WorldModule } from './modules/world/world.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { NeedsModule } from './modules/needs/needs.module';
import { SecurityModule } from './modules/security/security.module';
import { ProgressionModule } from './modules/progression/progression.module';
import { TravelModule } from './modules/travel/travel.module';

@Module({
  // SharedModule MUST be first — its @Global() providers (DomainEventBus, AppLogger)
  // are then available to every other module without needing explicit imports.
  imports: [
    SharedModule,
    SecurityModule,
    HealthModule,
    SimulationModule,
    RealtimeModule,
    ObservabilityModule,
    EconomyModule,
    AccountsModule,
    AuthModule,
    CharactersModule,
    WorldModule,
    CurrencyModule,
    NeedsModule,
    ProgressionModule,
    TravelModule,
  ],
})
export class AppModule {}
