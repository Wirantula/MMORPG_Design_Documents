// ── Visible stat families ────────────────────────────────────────

export interface PhysicalStats {
  STR: number; // Strength
  AGI: number; // Agility
  END: number; // Endurance
  REC: number; // Recovery
}

export interface MentalStats {
  INT: number; // Intelligence
  FOC: number; // Focus
  CRE: number; // Creativity
  MEM: number; // Memory
}

export interface SocialStats {
  CHA: number; // Charisma
  AUT: number; // Authority
  EMP: number; // Empathy
  DEC: number; // Deception
}

export interface PerceptualStats {
  AWR: number; // Awareness
  PRE: number; // Precision
  INS: number; // Insight
}

export interface SpiritualStats {
  WIL: number; // Willpower
  RES: number; // Resilience
  AET: number; // Aether
}

export interface EconomicStats {
  APR: number; // Appraisal
  NEG: number; // Negotiation
  LOG: number; // Logistics
}

/** Aggregate of all visible stat families. */
export interface VisibleStats {
  physical: PhysicalStats;
  mental: MentalStats;
  social: SocialStats;
  perceptual: PerceptualStats;
  spiritual: SpiritualStats;
  economic: EconomicStats;
}

export type StatFamily = keyof VisibleStats;

export const STAT_FAMILIES: StatFamily[] = [
  'physical',
  'mental',
  'social',
  'perceptual',
  'spiritual',
  'economic',
];

// ── Hidden potential layer ───────────────────────────────────────

export interface HiddenPotentialStats {
  growth_elasticity: number;
  ceiling_bias: number;
  fortune_bias: number;
  craft_intuition: number;
  combat_instinct: number;
  research_spark: number;
  trauma_susceptibility: number;
}

export type HiddenPotentialKey = keyof HiddenPotentialStats;

export const HIDDEN_POTENTIAL_KEYS: HiddenPotentialKey[] = [
  'growth_elasticity',
  'ceiling_bias',
  'fortune_bias',
  'craft_intuition',
  'combat_instinct',
  'research_spark',
  'trauma_susceptibility',
];

// ── Composite record (server-internal only) ─────────────────────

export interface CharacterStatRecord {
  characterId: string;
  visible: VisibleStats;
  potential: HiddenPotentialStats;
  initialisedAt: string;
}

// ── Player-facing DTO (hidden layer stripped) ───────────────────

export interface CharacterVisibleStatsDto {
  characterId: string;
  stats: VisibleStats;
}

// ── Admin-only DTO ──────────────────────────────────────────────

export interface CharacterPotentialDto {
  characterId: string;
  potential: HiddenPotentialStats;
}

// ── Wheel results input ─────────────────────────────────────────

export interface WheelOutcomesInput {
  race: string;
  aptitude: string;
  trait: string;
  origin: string;
  omen?: string;
}
