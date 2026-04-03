// ── Stat range constants ─────────────────────────────────────────

/** All stats range 0 – 1,000,000. Level 100 = peak human. */
export const STAT_MIN = 0;
export const STAT_MAX = 1_000_000;
export const PEAK_HUMAN = 100;
export const POTENTIAL_MIN = 0;
export const POTENTIAL_MAX = 100;

// ── Seeding bias tables ─────────────────────────────────────────
// Each wheel outcome contributes additive biases to the base stat seed.
// Values intentionally kept small so the RNG spread still dominates.

export type FamilyBias = {
  physical: number;
  mental: number;
  social: number;
  perceptual: number;
  spiritual: number;
  economic: number;
};

export type PotentialBias = {
  growth_elasticity: number;
  ceiling_bias: number;
  fortune_bias: number;
  craft_intuition: number;
  combat_instinct: number;
  research_spark: number;
  trauma_susceptibility: number;
};

/** Race → visible stat family bias */
export const RACE_FAMILY_BIAS: Record<string, Partial<FamilyBias>> = {
  human:    { social: 5, economic: 5 },
  elf:      { mental: 8, perceptual: 5 },
  dwarf:    { physical: 8, economic: 5 },
  orc:      { physical: 10, spiritual: 3 },
  fae:      { spiritual: 8, perceptual: 5 },
  beastkin: { physical: 5, perceptual: 8 },
  undine:   { spiritual: 5, mental: 5 },
  golem:    { physical: 10, mental: -3 },
};

/** Aptitude → hidden potential bias */
export const APTITUDE_POTENTIAL_BIAS: Record<string, Partial<PotentialBias>> = {
  warrior:    { combat_instinct: 15, growth_elasticity: 5 },
  scholar:    { research_spark: 15, ceiling_bias: 5 },
  artisan:    { craft_intuition: 15, growth_elasticity: 5 },
  diplomat:   { fortune_bias: 10, growth_elasticity: 5 },
  mystic:     { ceiling_bias: 10, research_spark: 5 },
  survivor:   { combat_instinct: 5, trauma_susceptibility: -10, growth_elasticity: 10 },
  trickster:  { fortune_bias: 15, craft_intuition: 5 },
  naturalist: { research_spark: 10, trauma_susceptibility: -5 },
};

/** Trait → visible stat family bias */
export const TRAIT_FAMILY_BIAS: Record<string, Partial<FamilyBias>> = {
  brave:      { physical: 3, spiritual: 3 },
  cunning:    { mental: 4, social: 2 },
  stoic:      { spiritual: 5 },
  charismatic: { social: 6 },
  perceptive: { perceptual: 6 },
  industrious: { economic: 5, physical: 2 },
  arcane:     { spiritual: 3, mental: 3 },
  wild:       { perceptual: 3, physical: 3 },
};

/** Origin → mixed bias on both visible and potential */
export const ORIGIN_FAMILY_BIAS: Record<string, Partial<FamilyBias>> = {
  noble:      { social: 5, economic: 3 },
  peasant:    { physical: 3, economic: 2 },
  nomad:      { perceptual: 4, physical: 2 },
  scholar:    { mental: 5 },
  outcast:    { spiritual: 4, perceptual: 2 },
  merchant:   { economic: 6 },
  temple:     { spiritual: 5, social: 2 },
  wilderness: { perceptual: 5, physical: 2 },
};

export const ORIGIN_POTENTIAL_BIAS: Record<string, Partial<PotentialBias>> = {
  noble:      { ceiling_bias: 5 },
  peasant:    { growth_elasticity: 5 },
  nomad:      { fortune_bias: 5 },
  scholar:    { research_spark: 5 },
  outcast:    { trauma_susceptibility: 10 },
  merchant:   { craft_intuition: 5 },
  temple:     { ceiling_bias: 5 },
  wilderness: { combat_instinct: 5 },
};

/** Omen → potential-only bias (optional wheel, small nudge) */
export const OMEN_POTENTIAL_BIAS: Record<string, Partial<PotentialBias>> = {
  star:     { fortune_bias: 8 },
  void:     { trauma_susceptibility: 8 },
  flame:    { combat_instinct: 8 },
  tide:     { growth_elasticity: 8 },
  shadow:   { craft_intuition: 8 },
  iron:     { ceiling_bias: 8 },
  dream:    { research_spark: 8 },
};
