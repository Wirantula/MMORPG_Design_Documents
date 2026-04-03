import { Global, Module } from '@nestjs/common';
import { DomainEventBus } from '../../common/domain-events';
import { AppLogger } from '../../common/logger.service';

/**
 * SharedModule owns DomainEventBus and AppLogger as application-wide singletons.
 * @Global() makes them available to every module without explicit imports.
 * Only AppModule needs to import SharedModule.
 *
 * Without this, each module (SimulationModule, AuthModule, CharactersModule, etc.)
 * declares its own DomainEventBus provider, causing NestJS to create separate
 * instances and producing conflicting DI tokens that silently break ALL constructor
 * injections in any gateway or service that also depends on module-exported providers.
 */
@Global()
@Module({
  providers: [DomainEventBus, AppLogger],
  exports: [DomainEventBus, AppLogger],
})
export class SharedModule {}
