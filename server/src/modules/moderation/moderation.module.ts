import { Module } from '@nestjs/common';
import { ModerationController, AdminModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { AdminModule } from '../admin/admin.module';
import { RealtimeModule } from '../realtime/realtime.module';

// NOTE: DomainEventBus is a global singleton from SharedModule.
// Do NOT add it to providers here — see AGENTS.md.

@Module({
  imports: [AuthModule, AccountsModule, AdminModule, RealtimeModule],
  controllers: [ModerationController, AdminModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
