import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DomainEventBus,
  generateEventId,
  type CharacterDied,
} from '../../common/domain-events';

// ── Character status & record ─────────────────────────────────────

export type CharacterStatus = 'alive' | 'dead' | 'unborn';

export interface Character {
  id: string;
  accountId: string;
  name: string;
  status: CharacterStatus;
  createdAt: string;
  diedAt: string | null;
}

// ── Error types ───────────────────────────────────────────────────

export class AliveCharacterExistsError extends Error {
  constructor(accountId: string) {
    super(`Account ${accountId} already has a living character`);
    this.name = 'AliveCharacterExistsError';
  }
}

// ── Service ───────────────────────────────────────────────────────

@Injectable()
export class CharactersService {
  private readonly logger = new Logger(CharactersService.name);

  /** In-memory store — will be replaced by PostgreSQL persistence. */
  private readonly characters = new Map<string, Character>();
  /** accountId → character id index for alive characters. */
  private readonly aliveIndex = new Map<string, string>();

  constructor(private readonly eventBus: DomainEventBus) {}

  // ── Queries ────────────────────────────────────────────────────

  findAliveByAccount(accountId: string): Character | undefined {
    const charId = this.aliveIndex.get(accountId);
    return charId ? this.characters.get(charId) : undefined;
  }

  findById(id: string): Character | undefined {
    return this.characters.get(id);
  }

  // ── Commands ───────────────────────────────────────────────────

  /**
   * Create a new living character for an account.
   * Enforces the one-alive-per-account invariant.
   * In production the DB partial unique index is the ultimate guard
   * against race conditions; this in-memory check is for fast feedback.
   */
  createCharacter(accountId: string, name: string): Character {
    if (this.aliveIndex.has(accountId)) {
      throw new AliveCharacterExistsError(accountId);
    }

    const now = new Date().toISOString();
    const character: Character = {
      id: randomUUID(),
      accountId,
      name,
      status: 'alive',
      createdAt: now,
      diedAt: null,
    };

    this.characters.set(character.id, character);
    this.aliveIndex.set(accountId, character.id);

    this.logger.log(
      `CharacterCreated account=${accountId} character=${character.id} name=${name}`,
      'CharactersService',
    );

    return character;
  }

  /**
   * Kill a character (permadeath).
   * Removes the alive-index entry so a new character can be created.
   * Emits CharacterDied domain event.
   */
  killCharacter(characterId: string, reason: string): Character {
    const character = this.characters.get(characterId);
    if (!character) {
      throw new Error(`Character ${characterId} not found`);
    }
    if (character.status !== 'alive') {
      throw new Error(`Character ${characterId} is not alive`);
    }

    character.status = 'dead';
    character.diedAt = new Date().toISOString();
    this.aliveIndex.delete(character.accountId);

    const event: CharacterDied = {
      eventId: generateEventId(),
      type: 'CharacterDied',
      timestamp: new Date().toISOString(),
      payload: {
        accountId: character.accountId,
        characterId: character.id,
        reason,
      },
    };
    this.eventBus.emit(event);

    this.logger.log(
      `CharacterDied account=${character.accountId} character=${characterId} reason=${reason}`,
      'CharactersService',
    );

    return character;
  }

  /**
   * Admin override: force-kill any alive character on the account,
   * allowing a fresh birth ritual.
   * RBAC enforcement is handled at the controller layer.
   */
  resetCharacter(accountId: string): { reset: boolean; characterId?: string } {
    const charId = this.aliveIndex.get(accountId);
    if (!charId) {
      return { reset: false };
    }

    this.killCharacter(charId, 'admin_reset');
    this.logger.log(
      `Admin reset: account=${accountId} character=${charId}`,
      'CharactersService',
    );

    return { reset: true, characterId: charId };
  }
}
