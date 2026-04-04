import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtGuard } from './admin.guard';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ObservabilityModule } from '../observability/observability.module';
import { RealtimeModule } from '../realtime/realtime.module';

// NOTE: DomainEventBus is a global singleton from SharedModule.
// Do NOT add it to providers here — see AGENTS.md.

@Module({
  imports: [AuthModule, AccountsModule, ObservabilityModule, RealtimeModule],
  controllers: [AdminController],
  providers: [AdminService, AdminJwtGuard],
  exports: [AdminService],
})
export class AdminModule {}
