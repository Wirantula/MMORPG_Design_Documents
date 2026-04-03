// ── Passive hidden trait taxonomy ────────────────────────────────

export const PASSIVE_TRAIT_NAMES = [
  'fortune_drift',
  'catastrophe_avoidance',
  'research_spark',
  'combat_instinct',
  'craft_intuition',
  'trauma_susceptibility',
] as const;

export type PassiveTraitName = (typeof PASSIVE_TRAIT_NAMES)[number];

// ── Weight constraints ──────────────────────────────────────────

export const TRAIT_WEIGHT_MIN = -100;
export const TRAIT_WEIGHT_MAX = 100;

// ── Weight bucket boundaries (for hint generation & logging) ────

export type WeightBucket = 'strong_negative' | 'negative' | 'neutral' | 'positive' | 'strong_positive';

export function classifyWeight(weight: number): WeightBucket {
  if (weight <= -60) return 'strong_negative';
  if (weight <= -20) return 'negative';
  if (weight <= 20) return 'neutral';
  if (weight <= 60) return 'positive';
  return 'strong_positive';
}

// ── Storage record (server-internal only) ───────────────────────

export interface PassiveTraitEntry {
  traitName: PassiveTraitName;
  weight: number; // -100 to +100
}

export interface CharacterPassiveTraits {
  characterId: string;
  traits: PassiveTraitEntry[];
  rolledAt: string;
}

// ── Player-facing DTO (no raw weights, only narrative hints) ────

export interface TraitHintDto {
  characterId: string;
  hints: string[];
}

// ── Wheel-outcome to trait bias mapping ─────────────────────────

export type TraitBiasMap = Partial<Record<PassiveTraitName, number>>;

/**
 * Maps wheel trait outcomes to passive trait weight biases.
 * Positive bias pushes weight toward +100, negative toward -100.
 */
export const WHEEL_TRAIT_BIAS: Record<string, TraitBiasMap> = {
  stoic:      { trauma_susceptibility: -30, catastrophe_avoidance: 20 },
  cunning:    { craft_intuition: 25, combat_instinct: 15 },
  volatile:   { trauma_susceptibility: 30, fortune_drift: -20 },
  scholarly:  { research_spark: 35, craft_intuition: 10 },
  reckless:   { fortune_drift: 25, catastrophe_avoidance: -30 },
  empathic:   { trauma_susceptibility: -20, catastrophe_avoidance: 15 },
  ruthless:   { combat_instinct: 30, trauma_susceptibility: 15 },
  mystical:   { fortune_drift: 30, research_spark: 15 },
};

/**
 * Maps wheel omen outcomes to passive trait weight biases.
 */
export const WHEEL_OMEN_BIAS: Record<string, TraitBiasMap> = {
  blessed:    { fortune_drift: 40, catastrophe_avoidance: 20 },
  cursed:     { fortune_drift: -40, trauma_susceptibility: 25 },
  fated:      { fortune_drift: 20, research_spark: 15 },
  unmarked:   {},
};

// ── Hint lookup table ───────────────────────────────────────────

/**
 * Maps (traitName, weightBucket) → narrative hint string.
 * Players see only these strings, never the raw weights.
 */
export const HINT_TABLE: Record<PassiveTraitName, Record<WeightBucket, string>> = {
  fortune_drift: {
    strong_negative: 'A persistent cloud of misfortune seems to follow you.',
    negative:        'Luck rarely seems to be on your side.',
    neutral:         'Fortune treats you as it treats most.',
    positive:        'You feel unnaturally lucky today.',
    strong_positive: 'Fate itself seems to bend in your favour.',
  },
  catastrophe_avoidance: {
    strong_negative: 'Danger finds you with alarming regularity.',
    negative:        'You often stumble into trouble unprepared.',
    neutral:         'Your instincts for danger are unremarkable.',
    positive:        'You have a knack for sidestepping disaster.',
    strong_positive: 'Catastrophe veers around you as if repelled.',
  },
  research_spark: {
    strong_negative: 'Study and discovery feel frustratingly elusive.',
    negative:        'Breakthroughs require more effort than most.',
    neutral:         'Your research aptitude is ordinary.',
    positive:        'Insights come to you with surprising ease.',
    strong_positive: 'Knowledge seems to illuminate itself in your presence.',
  },
  combat_instinct: {
    strong_negative: 'Your combat reflexes are notably sluggish.',
    negative:        'You hesitate a beat too long in battle.',
    neutral:         'Your fighting instincts are average.',
    positive:        'Your body reacts to threats before your mind catches up.',
    strong_positive: 'In combat, you move with an almost supernatural prescience.',
  },
  craft_intuition: {
    strong_negative: 'Materials seem to resist your shaping attempts.',
    negative:        'Crafting requires painstaking effort for modest results.',
    neutral:         'Your hands are steady but unremarkable at the forge.',
    positive:        'Raw materials seem to guide your hands into shape.',
    strong_positive: 'You craft with an effortless mastery that defies explanation.',
  },
  trauma_susceptibility: {
    strong_negative: 'Hardship barely leaves a mark on your psyche.',
    negative:        'You recover from setbacks faster than most.',
    neutral:         'Trauma affects you as it would anyone.',
    positive:        'Dark experiences linger in your thoughts longer than expected.',
    strong_positive: 'Every wound, physical or otherwise, cuts deeper than it should.',
  },
};
