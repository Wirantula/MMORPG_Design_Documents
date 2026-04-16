import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { AdminModule } from '../admin/admin.module';

// NOTE: DomainEventBus and AppLogger are global singletons from SharedModule.
// Do NOT add them to providers here — see AGENTS.md.

@Module({
  imports: [AdminModule],
  controllers: [OpsController],
  providers: [OpsService],
  exports: [OpsService],
})
export class OpsModule {}
