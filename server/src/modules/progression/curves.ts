import type { StatFamily } from '../characters/stats/stat.types';

// ── XP formula constants ────────────────────────────────────────
// xp_required(level) = BASE * (level ^ EXPONENT) * domainMultiplier
// Each tier requires proportionally more XP than the last.

export const XP_BASE = 100;
export const XP_EXPONENT = 1.85;

// ── Threshold breakpoints ───────────────────────────────────────
// Level 100  = peak human capability
// Level 101+ = superhuman; threshold effects apply above 100

export const PEAK_HUMAN_LEVEL = 100;
export const SUPERHUMAN_MAX_LEVEL = 500;

/**
 * Superhuman levels (101–500) have an additional multiplier that
 * makes each level significantly harder to achieve.
 */
export const SUPERHUMAN_EXTRA_EXPONENT = 0.35;

// ── Hidden potential modifiers ──────────────────────────────────
// growth_elasticity: multiplied directly into XP gain (range ~0.5–1.5)
// ceiling_bias: when stat level > ceiling_bias * 1000, soft cap triggers

export const SOFT_CAP_EFFICIENCY = 0.1;

// ── Domain-specific resistance multipliers ──────────────────────
// Prevents uniform grinding: each stat family has a different cost
// multiplier applied to xp_required().

export const DOMAIN_MULTIPLIERS: Record<StatFamily, number> = {
  physical: 1.0,
  mental: 1.2,
  social: 1.15,
  perceptual: 1.1,
  spiritual: 1.3,
  economic: 1.25,
};

// ── Decay constants ─────────────────────────────────────────────
// Only physically-maintained skills decay when unused.
// Threshold: >30 in-game days of inactivity.

export const DECAY_INACTIVITY_THRESHOLD_DAYS = 30;

/**
 * Per-day decay rate applied to the current level value.
 * Decay is multiplicative: level * (1 - DECAY_RATE_PER_DAY) per day
 * past the inactivity threshold.
 */
export const DECAY_RATE_PER_DAY = 0.002;

/** Only these stat families are subject to decay. */
export const DECAY_ELIGIBLE_FAMILIES: StatFamily[] = ['physical'];

// ── Pure formula helpers ────────────────────────────────────────

/**
 * Compute XP required to advance from `level` to `level + 1`
 * within a given stat family.
 */
export function xpRequired(level: number, family: StatFamily): number {
  if (level < 1 || level >= SUPERHUMAN_MAX_LEVEL) return Infinity;

  const domainMul = DOMAIN_MULTIPLIERS[family] ?? 1.0;
  let xp = XP_BASE * Math.pow(level, XP_EXPONENT) * domainMul;

  // Superhuman threshold effect
  if (level >= PEAK_HUMAN_LEVEL) {
    const superLevels = level - PEAK_HUMAN_LEVEL + 1;
    xp *= 1 + Math.pow(superLevels, SUPERHUMAN_EXTRA_EXPONENT);
  }

  return Math.round(xp);
}

/**
 * Check whether the soft cap applies given the character's ceiling_bias
 * and their current stat level.
 */
export function isSoftCapped(statLevel: number, ceilingBias: number): boolean {
  return statLevel > ceilingBias * 1000;
}
