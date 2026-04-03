import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type {
  WheelType,
  WheelDefinition,
  WheelContentFile,
  WheelOutcome,
} from './wheel.types';
import { WHEEL_TYPES } from './wheel.types';

// Resolve from server/ root (parent of src/) up to monorepo root then into tools/content
const WHEELS_JSON_PATH = resolve(__dirname, '..', '..', '..', '..', '..', 'tools', 'content', 'wheels.json');

function loadWheelData(): WheelContentFile {
  const raw = readFileSync(WHEELS_JSON_PATH, 'utf-8');
  return JSON.parse(raw) as WheelContentFile;
}

// ── Seeded PRNG (mulberry32) ─────────────────────────────────────
// Deterministic 32-bit PRNG so wheel outcomes are reproducible from a seed.

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

@Injectable()
export class WheelService {
  private readonly logger = new Logger(WheelService.name);
  private readonly content: WheelContentFile;

  constructor() {
    this.content = loadWheelData();
  }

  /** Get a wheel definition by type. */
  getWheelDefinition(wheelType: WheelType): WheelDefinition | undefined {
    return this.content.wheels[wheelType];
  }

  /** All known wheel types. */
  getWheelTypes(): WheelType[] {
    return [...WHEEL_TYPES];
  }

  /** Reroll cooldown duration in ms. */
  getRerollCooldownMs(): number {
    return this.content.rerollCooldownMs;
  }

  /** Coin cost per reroll. */
  getRerollCoinCost(): number {
    return this.content.rerollCoinCost;
  }

  /**
   * Spin a single wheel using a seeded PRNG.
   * Returns the selected outcome id.
   */
  spin(wheelType: WheelType, seed: number): string {
    const definition = this.getWheelDefinition(wheelType);
    if (!definition) {
      throw new Error(`Unknown wheel type: ${wheelType}`);
    }

    const rng = mulberry32(seed);
    const outcomeId = this.weightedSelect(definition.outcomes, rng());

    this.logger.log(
      `Wheel spin: ${wheelType} seed=${seed} outcome=${outcomeId}`,
      'WheelService',
    );

    return outcomeId;
  }

  /**
   * Weighted random selection from a list of outcomes.
   * `roll` should be in [0, 1).
   */
  weightedSelect(outcomes: WheelOutcome[], roll: number): string {
    const totalWeight = outcomes.reduce((sum, o) => sum + o.weight, 0);
    let cursor = 0;

    for (const outcome of outcomes) {
      cursor += outcome.weight / totalWeight;
      if (roll < cursor) {
        return outcome.id;
      }
    }

    // Fallback to last outcome (floating-point edge case)
    return outcomes[outcomes.length - 1].id;
  }
}
