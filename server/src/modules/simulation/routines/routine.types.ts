/**
 * Routine system types for offline play processing.
 *
 * Characters can configure up to MAX_ROUTINE_SLOTS routines that execute
 * automatically while the player is offline, at reduced efficiency.
 */

export const MAX_ROUTINE_SLOTS = 3;

/** Efficiency multiplier applied to offline routine XP and output rewards. */
export const OFFLINE_EFFICIENCY = 0.6;

/** Life stages where dangerous actions are blocked. */
export type LifeStage = 'infant' | 'child' | 'adolescent' | 'adult' | 'elder';

export const PROTECTED_LIFE_STAGES: ReadonlySet<LifeStage> = new Set<LifeStage>([
  'infant',
  'child',
]);

/**
 * A single routine slot configured by the player.
 * Priority determines execution order when multiple routines are queued (lower = first).
 */
export interface RoutineSlot {
  actionType: string;
  priority: number;
}

/** Character-level needs snapshot used for routine safety checks. */
export interface CharacterNeeds {
  hunger: number; // 0–100, 100 = starving
  fatigue: number; // 0–100, 100 = exhausted
}

/** Minimal character state required for routine processing. */
export interface CharacterState {
  characterId: string;
  lifeStage: LifeStage;
  routines: RoutineSlot[];
  needs: CharacterNeeds;
  /** ISO timestamp when the player went offline, or null if online. */
  offlineSince: string | null;
}

/** An individual action completed during offline processing. */
export interface OfflineActionEntry {
  actionType: string;
  completedCount: number;
  xpEarned: number;
}

/** Aggregated report delivered to the player on login. */
export interface OfflineReport {
  characterId: string;
  /** Total real-time milliseconds the player was offline. */
  durationMs: number;
  /** Number of individual actions completed. */
  actionsCompleted: number;
  /** Total XP earned (after efficiency penalty). */
  xpEarned: number;
  /** Per-action breakdown. */
  actions: OfflineActionEntry[];
  /** Changes to needs during offline period. */
  needsChanges: {
    hungerDelta: number;
    fatigueDelta: number;
  };
  /** Human-readable warnings (e.g. skipped due to critical needs). */
  warnings: string[];
}
