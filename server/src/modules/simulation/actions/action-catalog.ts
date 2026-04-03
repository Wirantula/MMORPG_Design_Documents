/** Duration constants expressed in in-game milliseconds. */
const GAME_HOUR_MS = 60 * 60 * 1000;

export type ActionCategory = 'labor' | 'rest' | 'social' | 'travel' | 'combat' | 'training';

export interface ActionDefinition {
  /** Unique stable identifier, e.g. "rest" or "forage". */
  id: string;
  /** Human-readable name. */
  name: string;
  /** How long the action takes in in-game milliseconds. */
  durationGameMs: number;
  /** Broad classification. */
  category: ActionCategory;
  /** Whether the action can be re-queued automatically on completion. */
  repeatable: boolean;
}

// ── Seed catalog (v1) ─────────────────────────────────────────────

const seedDefinitions: ActionDefinition[] = [
  {
    id: 'rest',
    name: 'Rest',
    durationGameMs: GAME_HOUR_MS * 8,
    category: 'rest',
    repeatable: true,
  },
  {
    id: 'forage',
    name: 'Forage',
    durationGameMs: GAME_HOUR_MS * 4,
    category: 'labor',
    repeatable: true,
  },
  {
    id: 'train-strength',
    name: 'Train Strength',
    durationGameMs: GAME_HOUR_MS * 3,
    category: 'training',
    repeatable: true,
  },
  {
    id: 'socialize',
    name: 'Socialize',
    durationGameMs: GAME_HOUR_MS * 2,
    category: 'social',
    repeatable: false,
  },
];

// ── Catalog accessor ──────────────────────────────────────────────

const catalogMap = new Map<string, ActionDefinition>(
  seedDefinitions.map((d) => [d.id, d]),
);

export function getActionDefinition(id: string): ActionDefinition | undefined {
  return catalogMap.get(id);
}

export function getAllActionDefinitions(): ActionDefinition[] {
  return [...catalogMap.values()];
}
