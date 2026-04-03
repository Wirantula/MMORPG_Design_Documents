export type ActionState = 'active' | 'paused' | 'completed' | 'cancelled';

export interface ActionSlot {
  characterId: string;
  definitionId: string;
  state: ActionState;
  /** World-time ms when the action was started. */
  startedAtWorldMs: number;
  /** World-time ms when the action will naturally complete. */
  endsAtWorldMs: number;
  /** World-time ms when the action was paused (if paused). */
  pausedAtWorldMs?: number;
  /** Accumulated world-ms already "used" before a pause. */
  elapsedBeforePauseMs: number;
}

/**
 * In-memory per-character action store (single active slot per character for v1).
 * Will be replaced by a persistent store once the persistence layer lands.
 */
export class ActionQueue {
  private readonly slots = new Map<string, ActionSlot>();

  get(characterId: string): ActionSlot | undefined {
    return this.slots.get(characterId);
  }

  set(characterId: string, slot: ActionSlot): void {
    this.slots.set(characterId, slot);
  }

  delete(characterId: string): boolean {
    return this.slots.delete(characterId);
  }

  /** Return all slots that are in the given state. */
  allInState(state: ActionState): ActionSlot[] {
    const result: ActionSlot[] = [];
    for (const slot of this.slots.values()) {
      if (slot.state === state) {
        result.push(slot);
      }
    }
    return result;
  }

  /** Return every tracked slot regardless of state. */
  all(): ActionSlot[] {
    return [...this.slots.values()];
  }

  size(): number {
    return this.slots.size;
  }
}
