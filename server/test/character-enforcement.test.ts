import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  CharactersService,
  AliveCharacterExistsError,
} from '../src/modules/characters/characters.service';
import { DomainEventBus } from '../src/common/domain-events';

function createService() {
  const eventBus = new DomainEventBus();
  const service = new CharactersService(eventBus);
  return { service, eventBus };
}

describe('CharactersService — single-character enforcement', () => {
  let ctx: ReturnType<typeof createService>;

  beforeEach(() => {
    ctx = createService();
  });

  // ── Create when none exists ────────────────────────────────────

  it('creates a character when account has no living character', () => {
    const char = ctx.service.createCharacter('acc-1', 'Hero');

    expect(char.id).toBeTruthy();
    expect(char.accountId).toBe('acc-1');
    expect(char.name).toBe('Hero');
    expect(char.status).toBe('alive');
    expect(char.diedAt).toBeNull();
  });

  it('returns the character via findAliveByAccount after creation', () => {
    const char = ctx.service.createCharacter('acc-1', 'Hero');
    const found = ctx.service.findAliveByAccount('acc-1');

    expect(found).toBeDefined();
    expect(found!.id).toBe(char.id);
  });

  // ── Create when one already exists (409 scenario) ──────────────

  it('throws AliveCharacterExistsError when account already has a living character', () => {
    ctx.service.createCharacter('acc-1', 'FirstHero');

    expect(() => ctx.service.createCharacter('acc-1', 'SecondHero')).toThrow(
      AliveCharacterExistsError,
    );
  });

  it('error message includes the account id', () => {
    ctx.service.createCharacter('acc-1', 'Hero');

    expect(() => ctx.service.createCharacter('acc-1', 'Hero2')).toThrow(
      /acc-1.*living character/,
    );
  });

  // ── Create after death (permadeath flow) ───────────────────────

  it('allows creating a new character after the previous one dies', () => {
    const first = ctx.service.createCharacter('acc-1', 'Mortal');
    ctx.service.killCharacter(first.id, 'combat');

    const second = ctx.service.createCharacter('acc-1', 'Reborn');

    expect(second.id).not.toBe(first.id);
    expect(second.status).toBe('alive');
    expect(ctx.service.findAliveByAccount('acc-1')!.id).toBe(second.id);
  });

  it('marks the killed character as dead with a diedAt timestamp', () => {
    const char = ctx.service.createCharacter('acc-1', 'Doomed');
    ctx.service.killCharacter(char.id, 'old_age');

    const dead = ctx.service.findById(char.id)!;
    expect(dead.status).toBe('dead');
    expect(dead.diedAt).toBeTruthy();
  });

  // ── Race condition simulation ──────────────────────────────────
  // In production the DB partial unique index (one_alive_per_account)
  // catches concurrent inserts. Here we verify the in-memory guard.

  it('rejects a second concurrent create for the same account', () => {
    // Simulate two "concurrent" create attempts
    ctx.service.createCharacter('acc-1', 'RaceA');

    // Second attempt should fail even though it happened "simultaneously"
    expect(() => ctx.service.createCharacter('acc-1', 'RaceB')).toThrow(
      AliveCharacterExistsError,
    );
  });

  it('different accounts can each have a living character', () => {
    const charA = ctx.service.createCharacter('acc-1', 'HeroA');
    const charB = ctx.service.createCharacter('acc-2', 'HeroB');

    expect(charA.status).toBe('alive');
    expect(charB.status).toBe('alive');
    expect(ctx.service.findAliveByAccount('acc-1')!.id).toBe(charA.id);
    expect(ctx.service.findAliveByAccount('acc-2')!.id).toBe(charB.id);
  });

  // ── CharacterDied event ────────────────────────────────────────

  it('emits CharacterDied event on kill', () => {
    const listener = vi.fn();
    ctx.eventBus.on('CharacterDied', listener);

    const char = ctx.service.createCharacter('acc-1', 'Victim');
    ctx.service.killCharacter(char.id, 'combat');

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0][0];
    expect(event.type).toBe('CharacterDied');
    expect(event.payload.accountId).toBe('acc-1');
    expect(event.payload.characterId).toBe(char.id);
    expect(event.payload.reason).toBe('combat');
  });

  it('does not emit CharacterDied on creation', () => {
    const listener = vi.fn();
    ctx.eventBus.on('CharacterDied', listener);

    ctx.service.createCharacter('acc-1', 'Alive');

    expect(listener).not.toHaveBeenCalled();
  });

  // ── Kill error cases ───────────────────────────────────────────

  it('rejects killing a non-existent character', () => {
    expect(() => ctx.service.killCharacter('fake-id', 'test')).toThrow(
      /not found/,
    );
  });

  it('rejects killing an already-dead character', () => {
    const char = ctx.service.createCharacter('acc-1', 'Hero');
    ctx.service.killCharacter(char.id, 'combat');

    expect(() => ctx.service.killCharacter(char.id, 'again')).toThrow(
      /not alive/,
    );
  });

  // ── Admin reset ────────────────────────────────────────────────

  it('admin reset kills alive character and returns reset=true', () => {
    const char = ctx.service.createCharacter('acc-1', 'Target');
    const result = ctx.service.resetCharacter('acc-1');

    expect(result.reset).toBe(true);
    expect(result.characterId).toBe(char.id);
    expect(ctx.service.findAliveByAccount('acc-1')).toBeUndefined();
  });

  it('admin reset returns reset=false when no alive character exists', () => {
    const result = ctx.service.resetCharacter('acc-999');

    expect(result.reset).toBe(false);
    expect(result.characterId).toBeUndefined();
  });

  it('admin reset allows creating a new character afterward', () => {
    ctx.service.createCharacter('acc-1', 'OldHero');
    ctx.service.resetCharacter('acc-1');

    const newChar = ctx.service.createCharacter('acc-1', 'NewHero');
    expect(newChar.status).toBe('alive');
    expect(newChar.name).toBe('NewHero');
  });

  it('admin reset emits CharacterDied with reason admin_reset', () => {
    const listener = vi.fn();
    ctx.eventBus.on('CharacterDied', listener);

    ctx.service.createCharacter('acc-1', 'Target');
    ctx.service.resetCharacter('acc-1');

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].payload.reason).toBe('admin_reset');
  });
});
