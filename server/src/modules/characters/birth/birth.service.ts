import { Injectable, Logger } from '@nestjs/common';
import {
  DomainEventBus,
  generateEventId,
  type CharacterBorn,
} from '../../../common/domain-events';
import { WheelService } from '../wheels/wheel.service';
import type {
  WheelType,
  BirthRitual,
  WheelResult,
  WheelCooldown,
} from '../wheels/wheel.types';
import { REQUIRED_WHEEL_TYPES } from '../wheels/wheel.types';

let idCounter = 0;
function nextCharacterId(): string {
  idCounter += 1;
  return `chr_${Date.now()}_${idCounter}`;
}

@Injectable()
export class BirthService {
  private readonly logger = new Logger(BirthService.name);

  // ── In-memory stores (placeholder until persistence layer exists) ──
  private readonly rituals = new Map<string, BirthRitual>();
  private readonly cooldowns = new Map<string, WheelCooldown[]>();
  private readonly balances = new Map<string, number>();

  constructor(
    private readonly wheelService: WheelService,
    private readonly eventBus: DomainEventBus,
  ) {}

  // ── Balance helpers (placeholder until accounts module) ────────

  getBalance(accountId: string): number {
    return this.balances.get(accountId) ?? 0;
  }

  creditBalance(accountId: string, amount: number): void {
    this.balances.set(accountId, this.getBalance(accountId) + amount);
  }

  private debitBalance(accountId: string, amount: number): boolean {
    const current = this.getBalance(accountId);
    if (current < amount) return false;
    this.balances.set(accountId, current - amount);
    return true;
  }

  // ── Ritual lifecycle ───────────────────────────────────────────

  /**
   * Start a new birth ritual for the given account.
   * Creates a character in 'unborn' status.
   */
  startRitual(accountId: string): BirthRitual {
    // Check for existing in-progress ritual
    for (const ritual of this.rituals.values()) {
      if (ritual.accountId === accountId && ritual.status !== 'complete') {
        throw new Error('Account already has an active birth ritual');
      }
    }

    const characterId = nextCharacterId();
    const ritual: BirthRitual = {
      accountId,
      characterId,
      status: 'unborn',
      spins: {},
      rerollCounts: {},
      createdAt: new Date().toISOString(),
    };

    this.rituals.set(characterId, ritual);

    this.logger.log(
      `Birth ritual started: account=${accountId} character=${characterId}`,
      'BirthService',
    );

    return ritual;
  }

  /**
   * Spin a wheel for the given character's ritual.
   * First spin on each wheel is free; rerolls incur a cooldown + coin cost.
   */
  spinWheel(
    characterId: string,
    wheelType: WheelType,
    nowMs = Date.now(),
  ): { outcomeId: string; ritual: BirthRitual } {
    const ritual = this.rituals.get(characterId);
    if (!ritual) {
      throw new Error(`No ritual found for character ${characterId}`);
    }
    if (ritual.status === 'complete') {
      throw new Error('Ritual already completed');
    }

    // Transition from unborn to in_progress on first spin
    if (ritual.status === 'unborn') {
      ritual.status = 'in_progress';
    }

    const previousSpinCount = ritual.rerollCounts[wheelType] ?? 0;
    const isReroll = previousSpinCount > 0;

    if (isReroll) {
      // Check cooldown
      this.enforceCooldown(ritual.accountId, wheelType, nowMs);

      // Check coin cost
      const cost = this.wheelService.getRerollCoinCost();
      if (!this.debitBalance(ritual.accountId, cost)) {
        throw new Error(
          `Insufficient balance for reroll (need ${cost} coins)`,
        );
      }
    }

    // Generate server-side seed from current time + character id + wheel type
    const seed = this.generateSeed(characterId, wheelType, nowMs);
    const outcomeId = this.wheelService.spin(wheelType, seed);

    // Record spin
    ritual.spins[wheelType] = outcomeId;
    ritual.rerollCounts[wheelType] = previousSpinCount + 1;

    // Set cooldown for this wheel
    if (previousSpinCount === 0) {
      // First spin — set cooldown for subsequent rerolls
      this.setCooldown(
        ritual.accountId,
        wheelType,
        nowMs + this.wheelService.getRerollCooldownMs(),
      );
    } else {
      // Extend cooldown from now
      this.setCooldown(
        ritual.accountId,
        wheelType,
        nowMs + this.wheelService.getRerollCooldownMs(),
      );
    }

    this.logger.log(
      `Wheel spin: character=${characterId} wheel=${wheelType} outcome=${outcomeId} reroll=${isReroll}`,
      'BirthService',
    );

    return { outcomeId, ritual };
  }

  /**
   * Complete the birth ritual.
   * All required wheels must have been spun.
   * Emits a CharacterBorn domain event.
   */
  completeRitual(characterId: string): BirthRitual {
    const ritual = this.rituals.get(characterId);
    if (!ritual) {
      throw new Error(`No ritual found for character ${characterId}`);
    }
    if (ritual.status === 'complete') {
      throw new Error('Ritual already completed');
    }

    // Verify all required wheels have been spun
    for (const requiredWheel of REQUIRED_WHEEL_TYPES) {
      if (!ritual.spins[requiredWheel]) {
        throw new Error(`Required wheel not spun: ${requiredWheel}`);
      }
    }

    ritual.status = 'complete';
    ritual.completedAt = new Date().toISOString();

    const wheelOutcomes: WheelResult = {
      race: ritual.spins.race!,
      aptitude: ritual.spins.aptitude!,
      trait: ritual.spins.trait!,
      origin: ritual.spins.origin!,
      omen: ritual.spins.omen,
    };

    // Emit CharacterBorn domain event
    const event: CharacterBorn = {
      eventId: generateEventId(),
      type: 'CharacterBorn',
      timestamp: new Date().toISOString(),
      payload: {
        accountId: ritual.accountId,
        characterId: ritual.characterId,
        wheelOutcomes,
      },
    };
    this.eventBus.emit(event);

    this.logger.log(
      `Birth ritual completed: account=${ritual.accountId} character=${characterId} race=${wheelOutcomes.race} aptitude=${wheelOutcomes.aptitude} trait=${wheelOutcomes.trait} origin=${wheelOutcomes.origin} omen=${wheelOutcomes.omen ?? 'none'}`,
      'BirthService',
    );

    return ritual;
  }

  // ── Queries ────────────────────────────────────────────────────

  getRitual(characterId: string): BirthRitual | undefined {
    return this.rituals.get(characterId);
  }

  getRitualByAccount(accountId: string): BirthRitual | undefined {
    for (const ritual of this.rituals.values()) {
      if (ritual.accountId === accountId && ritual.status !== 'complete') {
        return ritual;
      }
    }
    return undefined;
  }

  // ── Cooldown management ────────────────────────────────────────

  private enforceCooldown(
    accountId: string,
    wheelType: WheelType,
    nowMs: number,
  ): void {
    const accountCooldowns = this.cooldowns.get(accountId) ?? [];
    const cooldown = accountCooldowns.find((c) => c.wheelType === wheelType);

    if (cooldown && nowMs < cooldown.availableAt) {
      const remainingMs = cooldown.availableAt - nowMs;
      const remainingSec = Math.ceil(remainingMs / 1000);
      throw new Error(
        `Reroll cooldown active for wheel ${wheelType}. Available in ${remainingSec}s`,
      );
    }
  }

  private setCooldown(
    accountId: string,
    wheelType: WheelType,
    availableAt: number,
  ): void {
    const accountCooldowns = this.cooldowns.get(accountId) ?? [];
    const existing = accountCooldowns.find((c) => c.wheelType === wheelType);

    if (existing) {
      existing.availableAt = availableAt;
    } else {
      accountCooldowns.push({ accountId, wheelType, availableAt });
    }

    this.cooldowns.set(accountId, accountCooldowns);
  }

  getCooldown(
    accountId: string,
    wheelType: WheelType,
  ): WheelCooldown | undefined {
    const accountCooldowns = this.cooldowns.get(accountId) ?? [];
    return accountCooldowns.find((c) => c.wheelType === wheelType);
  }

  // ── Seed generation ────────────────────────────────────────────

  private generateSeed(
    characterId: string,
    wheelType: WheelType,
    nowMs: number,
  ): number {
    // Simple hash from character ID, wheel type, and timestamp
    let hash = 0;
    const input = `${characterId}:${wheelType}:${nowMs}`;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash + char) | 0;
    }
    return hash;
  }
}
