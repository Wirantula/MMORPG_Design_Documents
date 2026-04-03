/**
 * Routine types for Story 4.3 — Offline Routine Mode.
 *
 * Characters can define up to 3 routine slots that execute
 * automatically while the player is offline at 60 % efficiency.
 */

import type { ActionCategory } from '../actions/action-catalog';

// ── Life stages ────────────────────────────────────────────────────

export type LifeStage = 'infant' | 'child' | 'teen' | 'adult' | 'elder';

/** Action categories considered dangerous and blocked for infant / child. */
export const DANGEROUS_CATEGORIES: ReadonlySet<ActionCategory> = new Set([
  'combat',
  'travel',
]);

// ── Needs ──────────────────────────────────────────────────────────

export interface NeedsState {
  /** 0–100 scale; 0 = starving, 100 = fully fed. */
  hunger: number;
  /** 0–100 scale; 0 = exhausted, 100 = fully rested. */
  fatigue: number;
}

/** A need is critical when it drops to or below this threshold. */
export const NEEDS_CRITICAL_THRESHOLD = 10;

// ── Routine slots ──────────────────────────────────────────────────

export const MAX_ROUTINE_SLOTS = 3;

export interface RoutineSlot {
  /** References an ActionDefinition id (e.g. "rest", "forage"). */
  actionType: string;
  /** Lower number = higher priority (1 is highest). */
  priority: number;
}

// ── Offline state ──────────────────────────────────────────────────

export interface CharacterOfflineState {
  characterId: string;
  /** Real-time ms timestamp when the player went offline. */
  offlineSinceMs: number;
  routines: RoutineSlot[];
  lifeStage: LifeStage;
  needs: NeedsState;
}

// ── Offline report ─────────────────────────────────────────────────

export const OFFLINE_EFFICIENCY = 0.6;

export interface OfflineReportEntry {
  actionType: string;
  timesCompleted: number;
  /** XP earned for this action (already efficiency-adjusted). */
  xpEarned: number;
}

export interface OfflineReport {
  characterId: string;
  /** Real-time duration the player was offline (ms). */
  offlineDurationMs: number;
  /** World-time duration that elapsed while offline (ms). */
  worldDurationMs: number;
  actionsCompleted: OfflineReportEntry[];
  totalXpEarned: number;
  needsChanges: {
    hungerDelta: number;
    fatigueDelta: number;
  };
  warnings: string[];
}
