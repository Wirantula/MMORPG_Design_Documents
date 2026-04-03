// ── Wheel content types ──────────────────────────────────────────

export interface WheelOutcome {
  id: string;
  label: string;
  weight: number;
}

export interface WheelDefinition {
  label: string;
  optional?: boolean;
  outcomes: WheelOutcome[];
}

export type WheelType = 'race' | 'aptitude' | 'trait' | 'origin' | 'omen';

export const WHEEL_TYPES: WheelType[] = ['race', 'aptitude', 'trait', 'origin', 'omen'];
export const REQUIRED_WHEEL_TYPES: WheelType[] = ['race', 'aptitude', 'trait', 'origin'];

export interface WheelResult {
  race: string;
  aptitude: string;
  trait: string;
  origin: string;
  omen?: string;
}

export interface WheelContentFile {
  wheels: Record<WheelType, WheelDefinition>;
  rerollCooldownMs: number;
  rerollCoinCost: number;
}

// ── Birth ritual state ───────────────────────────────────────────

export type BirthStatus = 'unborn' | 'in_progress' | 'complete';

export interface BirthRitual {
  accountId: string;
  characterId: string;
  status: BirthStatus;
  spins: Partial<Record<WheelType, string>>;
  rerollCounts: Partial<Record<WheelType, number>>;
  createdAt: string;
  completedAt?: string;
}

export interface WheelCooldown {
  accountId: string;
  wheelType: WheelType;
  availableAt: number; // epoch ms
}
